<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { revealItemInDir } from "@tauri-apps/plugin-opener"
import Button from "../components/Button.vue"
import Modal from "../components/Modal.vue"
import BackupList from "../components/backups/BackupList.vue"
import BackupDetail from "../components/backups/BackupDetail.vue"
import JobPanel from "../components/backups/JobPanel.vue"
import NewBackupModal from "../components/backups/NewBackupModal.vue"
import RestoreModal from "../components/backups/RestoreModal.vue"
import { formatDateTime } from "../helpers/dateHelpers"
import { useConnectionStore } from "../stores/connectionStore"
import { useBackupStore } from "../stores/backupStore"
import type { Connection, Backup, RestoreMode } from "../types"

const { connections, groupedConnections, loadConnections } = useConnectionStore()
const {
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
} = useBackupStore()

onMounted(() => Promise.all([loadConnections(), loadBackups()]))

const selectedId = ref<string | null>(null)
const selectedBackup = computed(() => backups.value.find((d) => d.id === selectedId.value) ?? null)

// Keep something selected so the detail pane is never blank while backups exist
watch(
  backups,
  (list) => {
    if (!list.some((d) => d.id === selectedId.value)) selectedId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

const isNewBackupOpen = ref(false)
const isRestoreOpen = ref(false)
// Bumped on every open so each modal remounts with fresh state
const modalKey = ref(0)

function openNewBackup() {
  modalKey.value++
  isNewBackupOpen.value = true
}

function openRestore() {
  modalKey.value++
  isRestoreOpen.value = true
}
const backupToDelete = ref<Backup | null>(null)

async function startBackup(conn: Connection) {
  isNewBackupOpen.value = false
  const backup = await createBackup(conn)
  if (backup) selectedId.value = backup.id
}

function startRestore(target: Connection, mode: RestoreMode) {
  isRestoreOpen.value = false
  if (selectedBackup.value) restoreBackup(selectedBackup.value, target, mode)
}

async function confirmDelete() {
  if (backupToDelete.value) await deleteBackup(backupToDelete.value)
  backupToDelete.value = null
}

async function openFolder() {
  await revealItemInDir(await getBackupsDir())
}
</script>

<template>
  <div w-full h-full flex bg-gray-950 font-sans text-gray-300>
    <BackupList
      :groups="groupedBackups"
      :total="backups.length"
      :selected-id="selectedId"
      :is-running="isRunning"
      @select="selectedId = $event"
      @create="openNewBackup"
      @open-folder="openFolder"
    />

    <div flex-1 flex flex-col min-w-0>
      <div
        h-12
        border-b
        border-gray-800
        flex
        items-center
        px-4
        gap-2
        text-xs
        text-gray-400
        shrink-0
      >
        <div i-lucide-database-backup text-sm></div>
        <span font-medium>Backup &amp; restore</span>
      </div>

      <div flex-1 flex flex-col gap-4 p-6 min-h-0>
        <BackupDetail
          v-if="selectedBackup"
          :backup="selectedBackup"
          :is-running="isRunning"
          @restore="openRestore"
          @delete="backupToDelete = selectedBackup"
          @reveal="revealItemInDir(selectedBackup.path)"
        />

        <JobPanel v-if="job" :job="job" @dismiss="dismissJob" />

        <div
          v-if="!selectedBackup && !job"
          flex-1
          flex
          flex-col
          items-center
          justify-center
          gap-3
          text-gray-600
        >
          <div i-lucide-database-backup text-3xl text-gray-800></div>
          <p text-sm text-gray-500>Back up a connection to restore it anywhere later</p>
          <Button
            variant="primary"
            icon="i-lucide-plus"
            :disabled="isRunning"
            @click="openNewBackup"
          >
            New backup
          </Button>
        </div>
      </div>
    </div>

    <NewBackupModal
      :key="`new-${modalKey}`"
      :open="isNewBackupOpen"
      :groups="groupedConnections"
      @close="isNewBackupOpen = false"
      @start="startBackup"
    />

    <RestoreModal
      :key="`restore-${modalKey}`"
      :open="isRestoreOpen"
      :backup="selectedBackup"
      :connections="connections"
      @close="isRestoreOpen = false"
      @confirm="startRestore"
    />

    <Modal :open="backupToDelete !== null" title="Delete backup" @close="backupToDelete = null">
      <p text-sm text-gray-400>
        Delete the backup of
        <span font-semibold text-gray-200>{{ backupToDelete?.connectionName }}</span>
        taken on {{ backupToDelete && formatDateTime(backupToDelete.createdAt) }}? The file is
        removed from disk and cannot be recovered.
      </p>
      <template #footer>
        <Button variant="secondary" @click="backupToDelete = null">Cancel</Button>
        <Button variant="danger" @click="confirmDelete">Delete</Button>
      </template>
    </Modal>
  </div>
</template>
