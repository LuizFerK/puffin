export interface Connection {
  id: string
  name: string
  group?: string
  host: string
  port: number | ""
  database: string
  username: string
  password?: string
}

export interface SavedQuery {
  id: number
  name: string
  connectionName: string
  date: string
  code: string
}

export interface HistoryQuery {
  id: number
  connectionName: string
  timestamp: number
  code: string
}

export interface QueryConsoleState {
  queryText: string
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type CellValue = JsonValue

export interface QueryResult {
  columns: string[]
  rows: CellValue[][]
  row_count: number
  elapsed_ms: number
}

export interface PgError {
  detail: string
  hint: string | null
}

export interface ColumnInfo {
  name: string
  data_type: string
}

export type TableKind = "table" | "view" | "materialized_view" | "foreign_table"

export interface TableInfo {
  schema: string
  name: string
  kind: TableKind
  columns: ColumnInfo[]
}

export interface DatabaseSchema {
  tables: TableInfo[]
  search_path: string[]
}
