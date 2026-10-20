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

export interface ColumnSource {
  table_oid: number
  column: string
  data_type: string
  not_null: boolean
  generated: boolean
}

export interface ResultColumn {
  name: string
  type_name: string
  source: ColumnSource | null
  read_only_reason: string | null
}

export interface EditableTable {
  table_oid: number
  schema: string
  name: string
  key_columns: number[]
  keys: string[][]
}

export interface QueryResult {
  columns: string[]
  column_meta: ResultColumn[]
  tables: EditableTable[]
  rows: CellValue[][]
  row_count: number
  elapsed_ms: number
}

export interface ColumnValue {
  column: string
  data_type: string
  value: string | null
}

export interface RowUpdate {
  schema: string
  table: string
  key: ColumnValue[]
  set: ColumnValue[]
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
