import type { CellValue } from "../types"

export function formatCellValue(value: CellValue): string {
  if (value === null) return "NULL"
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === null ? "NULL" : String(v))).join(", ")}]`
  }
  return String(value)
}
