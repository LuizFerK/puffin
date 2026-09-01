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

export type CellValue = string | number | boolean | null | (string | number | boolean | null)[]

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
