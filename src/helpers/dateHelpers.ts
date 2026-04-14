export function timeAgo(timestamp: number) {
  const d = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  // Less than 1 minute
  if (diff < 60_000) return "Just now"
  // Less than 1 hour
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  // Less than 24 hours
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  // Otherwise show date
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatDateTime(timestamp: number) {
  const date = new Date(timestamp)

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}
