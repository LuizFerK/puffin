import type {
  CellValue,
  ColumnValue,
  EditableTable,
  JsonValue,
  QueryResult,
  RowUpdate,
} from "../types"

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

const PREVIEW_MAX = 200

// Table cells only show a few hundred chars, so huge values are cut before reaching the DOM
export function previewCellValue(value: CellValue): string {
  const text = formatCellValue(value)
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text
}

// --- Inline editing ---

export type PendingEdits = ReadonlyMap<string, string | null>

export const cellKey = (row: number, col: number) => `${row}:${col}`

export function parseCellKey(key: string): [number, number] {
  const [row, col] = key.split(":").map(Number)
  return [row, col]
}

const needsArrayQuoting = (text: string) =>
  text === "" || /^null$/i.test(text) || /[{}",\\\s]/.test(text)

function formatArrayLiteralElement(value: JsonValue): string {
  if (value === null) return "NULL"
  if (Array.isArray(value)) return formatArrayLiteral(value)
  const text = typeof value === "object" ? JSON.stringify(value) : String(value)
  return needsArrayQuoting(text) ? `"${text.replace(/[\\"]/g, "\\$&")}"` : text
}

function formatArrayLiteral(values: JsonValue[]): string {
  return `{${values.map(formatArrayLiteralElement).join(",")}}`
}

// json[] elements are whole JSON documents, never nested array dimensions
const formatJsonArrayElement = (value: JsonValue): JsonValue =>
  value === null ? null : JSON.stringify(value)

// Serializes a cell into Postgres input syntax, the inverse of what the backend decoded
export function toPgText(value: CellValue, typeName: string): string | null {
  if (value === null) return null
  if (typeName === "json" || typeName === "jsonb") return JSON.stringify(value)
  if (typeName === "_json" || typeName === "_jsonb") {
    return formatArrayLiteral((value as JsonValue[]).map(formatJsonArrayElement))
  }
  if (Array.isArray(value)) return formatArrayLiteral(value)
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export const editorText = (value: CellValue, typeName: string): string =>
  toPgText(value, typeName) ?? ""

const isJsonType = (typeName: string) => typeName === "json" || typeName === "jsonb"

function reformatJson(text: string, indent?: number): string {
  try {
    return JSON.stringify(JSON.parse(text), null, indent)
  } catch {
    return text
  }
}

// Editable text for the cell viewer: Postgres input syntax, with JSON pretty-printed.
// Pending edits already hold Postgres text (pgText), so only JSON needs reformatting.
export function viewerText(value: CellValue, typeName: string, pgText = false): string {
  if (value === null) return ""
  if (pgText) return isJsonType(typeName) ? reformatJson(value as string, 2) : (value as string)
  return isJsonType(typeName) ? JSON.stringify(value, null, 2) : editorText(value, typeName)
}

// Compacts JSON back to what editorText produces, so an untouched viewer save isn't a change
// NOTE(LuizFerK): the JSON.parse round-trip is lossy (ints above 2^53, 1.10 -> 1.1, duplicate
// keys in json), unlike the inline editor, and canSave already blocks untouched saves
export const compactViewerText = (text: string, typeName: string): string =>
  isJsonType(typeName) ? reformatJson(text) : text

const INTEGER = /^[+-]?\d+$/
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i
const FLOAT_SPECIAL = /^[+-]?(infinity|inf|nan)$/i
const BOOLEAN = /^(t|f|true|false|y|n|yes|no|on|off|1|0)$/i
const UUID = /^\{?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\}?$/i

const checkInteger = (text: string) => (INTEGER.test(text) ? null : "Expected an integer")
const checkDecimal = (text: string) =>
  DECIMAL.test(text) || /^nan$/i.test(text) ? null : "Expected a number"
const checkFloat = (text: string) =>
  DECIMAL.test(text) || FLOAT_SPECIAL.test(text) ? null : "Expected a number"
const checkBoolean = (text: string) => (BOOLEAN.test(text) ? null : "Expected true or false")
const checkUuid = (text: string) => (UUID.test(text) ? null : "Expected a UUID")

function checkJson(text: string) {
  try {
    JSON.parse(text)
    return null
  } catch {
    return "Invalid JSON"
  }
}

const VALIDATORS: Record<string, (text: string) => string | null> = {
  int2: checkInteger,
  int4: checkInteger,
  int8: checkInteger,
  oid: checkInteger,
  float4: checkFloat,
  float8: checkFloat,
  numeric: checkDecimal,
  bool: checkBoolean,
  uuid: checkUuid,
  json: checkJson,
  jsonb: checkJson,
}

// Catches obvious mistakes before a round trip; Postgres has the final word on the cast
export function validateCellText(typeName: string, text: string | null): string | null {
  if (text === null) return null
  // Postgres ignores surrounding whitespace for all of these types
  return VALIDATORS[typeName]?.(text.trim()) ?? null
}

// Key text comes from the backend verbatim, so the row is matched exactly
function keyValues(result: QueryResult, table: EditableTable, row: number): ColumnValue[] {
  return table.key_columns.map((idx, k) => {
    const source = result.column_meta[idx].source!
    return { column: source.column, data_type: source.data_type, value: table.keys[row][k] }
  })
}

// Groups pending cells into one UPDATE per (row, table).
// targets[i][j] is the [row, col] cell that updates[i].set[j] writes back to.
export function buildRowUpdates(result: QueryResult, pending: PendingEdits) {
  const groups = new Map<string, { update: RowUpdate; targets: [number, number][] }>()

  for (const [key, value] of pending) {
    const [row, col] = parseCellKey(key)
    const source = result.column_meta[col].source!
    const groupKey = `${row}:${source.table_oid}`

    if (!groups.has(groupKey)) {
      const table = result.tables.find((t) => t.table_oid === source.table_oid)!
      groups.set(groupKey, {
        update: { schema: table.schema, table: table.name, key: keyValues(result, table, row), set: [] },
        targets: [],
      })
    }

    const group = groups.get(groupKey)!
    group.update.set.push({ column: source.column, data_type: source.data_type, value })
    group.targets.push([row, col])
  }

  const entries = [...groups.values()]
  return { updates: entries.map((e) => e.update), targets: entries.map((e) => e.targets) }
}
