export interface Connection {
  id: string
  name: string
  group?: string
  host: string
  port: number | ''
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

export interface QueryConsoleState {
  queryText: string
}
