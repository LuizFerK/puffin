import { describe, expect, it } from "vitest"
import { formatBytes, formatDuration, groupBackupsByConnection } from "../../src/helpers/backupHelpers"
import type { Backup } from "../../src/types"

function backup(id: string, connectionId: string, createdAt: number, connectionName = connectionId): Backup {
  return {
    id,
    connectionId,
    connectionName,
    host: "localhost",
    port: 5432,
    database: "app",
    createdAt,
    path: `/backups/${id}.dump`,
    sizeBytes: 0,
    durationMs: 0,
  }
}

describe("formatBytes", () => {
  it("picks the largest whole unit", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(5 * 1024 ** 3)).toBe("5.0 GB")
  })
})

describe("formatDuration", () => {
  it("scales from milliseconds to minutes", () => {
    expect(formatDuration(450)).toBe("450ms")
    expect(formatDuration(12_400)).toBe("12s")
    expect(formatDuration(125_000)).toBe("2m 5s")
  })
})

describe("groupBackupsByConnection", () => {
  it("groups by connection, newest backup and newest group first", () => {
    const groups = groupBackupsByConnection([
      backup("a1", "alpha", 1),
      backup("b1", "beta", 2),
      backup("a2", "alpha", 3),
    ])

    expect(groups.map((g) => g.name)).toEqual(["alpha", "beta"])
    expect(groups[0].backups.map((d) => d.id)).toEqual(["a2", "a1"])
  })

  it("keeps connections that share a name apart, labeled by their newest name", () => {
    const groups = groupBackupsByConnection([
      backup("p1", "prod", 1, "Orders"),
      backup("s1", "staging", 2, "Orders"),
      backup("p2", "prod", 3, "Production Orders"),
    ])

    expect(groups.map((g) => [g.id, g.name])).toEqual([
      ["prod", "Production Orders"],
      ["staging", "Orders"],
    ])
  })
})
