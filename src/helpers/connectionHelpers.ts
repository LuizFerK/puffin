import type { Connection } from "../types"

// Shape expected by the backend's ConnectionParams
export function toConnectionParams(conn: Connection) {
  return {
    host: conn.host,
    port: Number(conn.port),
    database: conn.database,
    username: conn.username,
    password: conn.password || "",
  }
}
