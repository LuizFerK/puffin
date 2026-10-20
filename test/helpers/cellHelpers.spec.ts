import { describe, expect, it } from "vitest"
import {
  buildRowUpdates,
  cellKey,
  editorText,
  toPgText,
  validateCellText,
} from "../../src/helpers/cellHelpers"
import type { ColumnSource, QueryResult, ResultColumn } from "../../src/types"

const USERS = 100
const ORDERS = 200

function source(table_oid: number, column: string, data_type: string, extra: Partial<ColumnSource> = {}) {
  return { table_oid, column, data_type, not_null: false, generated: false, ...extra }
}

function column(name: string, type_name: string, src: ColumnSource | null = null): ResultColumn {
  return { name, type_name, source: src, read_only_reason: null }
}

function result(
  column_meta: ResultColumn[],
  rows: QueryResult["rows"],
  tables: QueryResult["tables"],
): QueryResult {
  return {
    columns: column_meta.map((c) => c.name),
    column_meta,
    tables,
    rows,
    row_count: rows.length,
    elapsed_ms: 0,
  }
}

describe("toPgText", () => {
  it("serializes scalars as their text form", () => {
    expect(toPgText(null, "text")).toBeNull()
    expect(toPgText("abc", "text")).toBe("abc")
    expect(toPgText(42, "int4")).toBe("42")
    expect(toPgText(1.5, "float8")).toBe("1.5")
    expect(toPgText(true, "bool")).toBe("true")
  })

  it("stringifies json values, including scalars and arrays", () => {
    expect(toPgText({ a: [1, 2] }, "jsonb")).toBe('{"a":[1,2]}')
    expect(toPgText("abc", "json")).toBe('"abc"')
    expect(toPgText([1, 2], "jsonb")).toBe("[1,2]")
  })

  it("builds Postgres array literals with quoting and NULLs", () => {
    expect(toPgText([1, 2, null], "_int4")).toBe("{1,2,NULL}")
    expect(toPgText(["a", "b c", 'q"t', "x,y", "", "null", "back\\slash"], "_text")).toBe(
      '{a,"b c","q\\"t","x,y","","null","back\\\\slash"}',
    )
  })

  it("quotes each element of a json array", () => {
    expect(toPgText([{ a: 1 }, null], "_jsonb")).toBe('{"{\\"a\\":1}",NULL}')
  })
})

describe("editorText", () => {
  it("starts empty for NULL", () => {
    expect(editorText(null, "text")).toBe("")
    expect(editorText("hello", "text")).toBe("hello")
    expect(editorText(["a", null], "_text")).toBe("{a,NULL}")
  })
})

describe("validateCellText", () => {
  it("checks integers", () => {
    expect(validateCellText("int4", " -12 ")).toBeNull()
    expect(validateCellText("int8", "1.5")).toBe("Expected an integer")
  })

  it("checks numbers", () => {
    expect(validateCellText("numeric", "1.50")).toBeNull()
    expect(validateCellText("float8", "1e-3")).toBeNull()
    expect(validateCellText("float8", "Infinity")).toBeNull()
    expect(validateCellText("numeric", "abc")).toBe("Expected a number")
  })

  it("checks booleans, uuids and json", () => {
    expect(validateCellText("bool", "yes")).toBeNull()
    expect(validateCellText("bool", "maybe")).toBe("Expected true or false")
    expect(validateCellText("uuid", "550e8400-e29b-41d4-a716-446655440000")).toBeNull()
    expect(validateCellText("uuid", "nope")).toBe("Expected a UUID")
    expect(validateCellText("jsonb", '{"a": 1}')).toBeNull()
    expect(validateCellText("jsonb", "{a: 1}")).toBe("Invalid JSON")
  })

  it("accepts NULL and leaves unknown types to Postgres", () => {
    expect(validateCellText("int4", null)).toBeNull()
    expect(validateCellText("date", "whatever")).toBeNull()
  })
})

describe("buildRowUpdates", () => {
  const joined = result(
    [
      column("id", "int8", source(USERS, "id", "bigint")),
      column("name", "text", source(USERS, "name", "text")),
      column("age", "int4", source(USERS, "age", "integer")),
      column("order_id", "int4", source(ORDERS, "id", "integer")),
      column("amount", "numeric", source(ORDERS, "amount", "numeric(10,2)")),
    ],
    [
      ["9007199254740993", "Ana", 30, 10, "1.50"],
      ["9007199254740994", "Bia", 25, 11, "2.00"],
    ],
    [
      {
        table_oid: USERS,
        schema: "public",
        name: "users",
        key_columns: [0],
        keys: [["9007199254740993"], ["9007199254740994"]],
      },
      { table_oid: ORDERS, schema: "sales", name: "orders", key_columns: [3], keys: [["10"], ["11"]] },
    ],
  )

  it("groups edits of the same row and table into one update", () => {
    const pending = new Map([
      [cellKey(0, 1), "Ann"],
      [cellKey(0, 2), null],
    ])
    expect(buildRowUpdates(joined, pending)).toEqual({
      updates: [
        {
          schema: "public",
          table: "users",
          key: [{ column: "id", data_type: "bigint", value: "9007199254740993" }],
          set: [
            { column: "name", data_type: "text", value: "Ann" },
            { column: "age", data_type: "integer", value: null },
          ],
        },
      ],
      targets: [
        [
          [0, 1],
          [0, 2],
        ],
      ],
    })
  })

  it("splits edits across tables and rows", () => {
    const pending = new Map([
      [cellKey(0, 1), "Ann"],
      [cellKey(0, 4), "9.99"],
      [cellKey(1, 1), "Bea"],
    ])
    const { updates, targets } = buildRowUpdates(joined, pending)
    expect(updates.map((u) => [u.table, u.key[0].value])).toEqual([
      ["users", "9007199254740993"],
      ["orders", "10"],
      ["users", "9007199254740994"],
    ])
    expect(targets).toEqual([[[0, 1]], [[0, 4]], [[1, 1]]])
  })

  it("uses the backend key text even when the key itself is edited", () => {
    const { updates } = buildRowUpdates(joined, new Map([[cellKey(1, 0), "5"]]))
    expect(updates[0].key[0].value).toBe("9007199254740994")
    expect(updates[0].set[0].value).toBe("5")
  })
})
