import type { Backup } from "../types"

const UNITS = ["B", "KB", "MB", "GB", "TB"]

export function formatBytes(bytes: number): string {
  const exponent = bytes > 0 ? Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1) : 0
  const value = bytes / 1024 ** exponent
  return `${exponent === 0 ? value : value.toFixed(1)} ${UNITS[exponent]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

// Newest first, groups ordered by their latest backup
export function groupBackupsByConnection(backups: Backup[]): { name: string; backups: Backup[] }[] {
  const groups = [...backups]
    .sort((a, b) => b.createdAt - a.createdAt)
    .reduce((acc, backup) => {
      const list = acc.get(backup.connectionName)
      list ? list.push(backup) : acc.set(backup.connectionName, [backup])
      return acc
    }, new Map<string, Backup[]>())
  return [...groups].map(([name, backups]) => ({ name, backups }))
}
