import type { Connection } from "../types"

const COLORS = ["#4ade80", "#facc15", "#38bdf8", "#f87171", "#c084fc", "#fb923c"]

export const connectionColor = (index: number) => COLORS[index % COLORS.length]

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
