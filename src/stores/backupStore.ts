import { computed, markRaw, ref } from "vue"
import { lazyStore } from "../helpers/storeHelpers"
import { Channel, invoke } from "@tauri-apps/api/core"
import type { Connection, Backup, BackupJob, PgError, RestoreMode } from "../types"
import { connectionLabel, toConnectionParams } from "../helpers/connectionHelpers"
import { groupBackupsByConnection } from "../helpers/backupHelpers"

const STORE_FILE = "backups.json"

// pg_dump --verbose prints a few lines per object; older lines only cost memory
const MAX_LOG_LINES = 2000

const backups = ref<Backup[]>([])
const job = ref<BackupJob | null>(null)
let loaded = false

const getStore = lazyStore(STORE_FILE)

async function persist() {
  const s = await getStore()
  await s.set("backups", backups.value)
}

async function loadBackups() {
  if (loaded) return
  const s = await getStore()
  backups.value = (await s.get<Backup[]>("backups")) ?? []
  loaded = true
}

const groupedBackups = computed(() => groupBackupsByConnection(backups.value))

const isRunning = computed(() => job.value?.status === "running")

// Lines arrive as one IPC message each; batching them per frame keeps rendering off that path
function logChannel(current: BackupJob) {
  let buffer: string[] = []
  let frame = 0

  const flush = () => {
    frame = 0
    if (buffer.length === 0) return
    // Replaced whole and raw: one reactive update per batch, no per-line tracking
    current.log = markRaw([...current.log, ...buffer].slice(-MAX_LOG_LINES))
    buffer = []
  }

  const channel = new Channel<string>()
  channel.onmessage = (line) => {
    buffer.push(line)
    frame ||= requestAnimationFrame(flush)
  }
  return { channel, flush }
}

async function runJob<T>(
  title: string,
  task: (channel: Channel<string>, startedAt: number) => Promise<T>,
  successMessage: string | null = null,
): Promise<T | null> {
  if (isRunning.value) return null
  job.value = {
    title,
    status: "running",
    log: [],
    error: null,
    successMessage,
    startedAt: Date.now(),
    finishedAt: null,
  }
  const current = job.value
  const { channel, flush } = logChannel(current)

  const finish = (error: PgError | null) => {
    flush()
    current.status = error ? "error" : "success"
    current.error = error
    current.finishedAt = Date.now()
  }

  try {
    const result = await task(channel, current.startedAt)
    finish(null)
    return result
  } catch (e) {
    finish(e as PgError)
    return null
  }
}

const createBackup = (conn: Connection) =>
  runJob(`Backing up ${connectionLabel(conn)}`, async (channel, startedAt) => {
    const file = await invoke<{ path: string; size_bytes: number }>("create_backup", {
      connection: toConnectionParams(conn),
      onLog: channel,
    })
    const backup: Backup = {
      id: crypto.randomUUID(),
      connectionId: conn.id,
      connectionName: connectionLabel(conn),
      host: conn.host,
      port: Number(conn.port),
      database: conn.database,
      createdAt: startedAt,
      path: file.path,
      sizeBytes: file.size_bytes,
      durationMs: Date.now() - startedAt,
    }
    backups.value.unshift(backup)
    await persist()
    return backup
  })

const restoreBackup = (backup: Backup, target: Connection, mode: RestoreMode) =>
  runJob(
    `Restoring into ${connectionLabel(target)}`,
    (channel) =>
      invoke("restore_backup", {
        connection: toConnectionParams(target),
        path: backup.path,
        mode,
        onLog: channel,
      }),
    "puffin: restore finished successfully",
  )

async function deleteBackup(backup: Backup) {
  await invoke("delete_backup", { path: backup.path })
  backups.value = backups.value.filter((d) => d.id !== backup.id)
  await persist()
}

function dismissJob() {
  if (!isRunning.value) job.value = null
}

const getBackupsDir = () => invoke<string>("get_backups_dir")

export function useBackupStore() {
  return {
    backups,
    groupedBackups,
    job,
    isRunning,
    loadBackups,
    createBackup,
    restoreBackup,
    deleteBackup,
    dismissJob,
    getBackupsDir,
  }
}
