import type { DatabaseSchema, TableInfo } from "../../../src/types"
import {
  getCompletions,
  type CompletionItem,
  type ItemKind,
} from "../../../src/sql/completion"

const table = (
  schema: string,
  name: string,
  columns: [string, string][],
  kind: TableInfo["kind"] = "table",
): TableInfo => ({
  schema,
  name,
  kind,
  columns: columns.map(([name, data_type]) => ({ name, data_type })),
})

export const db: DatabaseSchema = {
  search_path: ["public"],
  tables: [
    table("public", "users", [
      ["id", "uuid"],
      ["name", "text"],
      ["email", "text"],
      ["created_at", "timestamp with time zone"],
    ]),
    table("public", "orders", [
      ["id", "uuid"],
      ["user_id", "uuid"],
      ["total", "numeric(10,2)"],
      ["status", "text"],
      ["created_at", "timestamp with time zone"],
    ]),
    table("public", "order_items", [
      ["id", "uuid"],
      ["order_id", "uuid"],
      ["product_id", "uuid"],
      ["quantity", "integer"],
    ]),
    table("public", "products", [
      ["id", "uuid"],
      ["name", "text"],
      ["price", "numeric"],
    ]),
    table(
      "public",
      "active_users",
      [
        ["id", "uuid"],
        ["name", "text"],
      ],
      "view",
    ),
    table("public", "UserProfiles", [
      ["id", "uuid"],
      ["Display Name", "text"],
    ]),
    table("billing", "invoices", [
      ["id", "uuid"],
      ["order_id", "uuid"],
      ["amount", "numeric"],
    ]),
  ],
}

export const columnsOf = (name: string) =>
  db.tables.find((t) => t.name === name)!.columns.map((c) => c.name)

/** Splits `SELECT | FROM t` into the text and the cursor offset marked by `|`. */
export function parseCursor(input: string): { sql: string; offset: number } {
  const offset = input.indexOf("|")
  if (offset === -1 || input.indexOf("|", offset + 1) !== -1) {
    throw new Error(`expected exactly one cursor marker in: ${input}`)
  }
  return { sql: input.slice(0, offset) + input.slice(offset + 1), offset }
}

export function complete(input: string, schema: DatabaseSchema | null = db) {
  const { sql, offset } = parseCursor(input)
  return getCompletions(sql, offset, schema)
}

const labelsOf = (items: CompletionItem[], kinds: ItemKind[]) =>
  items.filter((i) => kinds.includes(i.kind)).map((i) => i.label)

/** Suggestion labels grouped by kind, for compact assertions. */
export function suggest(input: string, schema: DatabaseSchema | null = db) {
  const { items, ...rest } = complete(input, schema)
  const columns = items.filter((i) => i.kind === "column")
  return {
    ...rest,
    items,
    all: items.map((i) => i.label),
    keywords: labelsOf(items, ["keyword"]),
    tables: labelsOf(items, ["table", "view", "cte"]),
    schemas: labelsOf(items, ["schema"]),
    functions: labelsOf(items, ["function"]),
    aliases: labelsOf(items, ["alias"]),
    columns: columns.map((i) => i.label),
    /** Columns as `qualifier.column`, to tell which table each one came from. */
    qualifiedColumns: columns.map((i) => `${i.description}.${i.label}`),
  }
}
