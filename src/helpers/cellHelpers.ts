import type { CellValue, JsonValue } from "../types"

// Mirrors Postgres' json/jsonb text output: `{"a": 1, "b": [1, 2]}`
function formatJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(formatJson).join(", ")}]`
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${formatJson(v)}`)
    return `{${entries.join(", ")}}`
  }
  return JSON.stringify(value)
}

function formatArrayElement(value: JsonValue): string {
  if (value === null) return "NULL"
  if (typeof value === "object") return formatJson(value)
  return String(value)
}

export function formatCellValue(value: CellValue): string {
  if (value === null) return "NULL"
  if (Array.isArray(value)) return `[${value.map(formatArrayElement).join(", ")}]`
  if (typeof value === "object") return formatJson(value)
  return String(value)
}
