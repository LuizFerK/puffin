import { describe, expect, it } from "vitest"
import { findTable, scopeAt } from "../../../src/sql/completion/scope"
import {
  buildStructure,
  groupAt,
  statementAt,
} from "../../../src/sql/completion/statement"
import { db, parseCursor } from "./fixtures"

function scopeFor(input: string) {
  const { sql, offset } = parseCursor(input)
  const structure = buildStructure(statementAt(sql, offset).tokens)
  return scopeAt(structure, groupAt(structure, offset), db)
}

/** `alias->table@depth: columns` for each entry in scope. */
const describeScope = (input: string) =>
  scopeFor(input).entries.map(
    (e) =>
      `${e.ref.alias ?? "-"}->${e.ref.name}@${e.depth}: ${e.columns.map((c) => c.name).join(",")}`,
  )

const refs = (input: string) =>
  scopeFor(input).entries.map((e) => [e.ref.alias, e.ref.name])

describe("table references", () => {
  it("reads a plain FROM", () => {
    expect(refs("SELECT | FROM users")).toEqual([[null, "users"]])
  })

  it("reads aliases with and without AS", () => {
    expect(refs("SELECT | FROM users u, orders AS o")).toEqual([
      ["u", "users"],
      ["o", "orders"],
    ])
  })

  it("does not take a following keyword as an alias", () => {
    expect(refs("SELECT | FROM users WHERE id = 1")).toEqual([[null, "users"]])
    expect(refs("SELECT | FROM users LEFT JOIN orders ON true")).toEqual([
      [null, "users"],
      [null, "orders"],
    ])
    expect(refs("SELECT | FROM users ORDER BY 1 LIMIT 1")).toEqual([
      [null, "users"],
    ])
  })

  it("reads every kind of join", () => {
    const sql = `SELECT | FROM users u
      JOIN orders o ON o.user_id = u.id
      LEFT OUTER JOIN order_items oi ON oi.order_id = o.id
      CROSS JOIN products p
      NATURAL FULL JOIN active_users au`
    expect(refs(sql)).toEqual([
      ["u", "users"],
      ["o", "orders"],
      ["oi", "order_items"],
      ["p", "products"],
      ["au", "active_users"],
    ])
  })

  it("reads tables after the cursor", () => {
    expect(refs("SELECT u.| FROM users u")).toEqual([["u", "users"]])
  })

  it("reads schema-qualified and quoted names", () => {
    const entries = scopeFor(
      'SELECT | FROM billing.invoices i, "UserProfiles" up',
    ).entries
    expect(
      entries.map((e) => [
        e.ref.schema,
        e.ref.name,
        e.ref.quoted,
        e.columns.map((c) => c.name),
      ]),
    ).toEqual([
      ["billing", "invoices", false, ["id", "order_id", "amount"]],
      [null, "UserProfiles", true, ["id", "Display Name"]],
    ])
  })

  it("reads UPDATE, INSERT INTO and DELETE FROM targets", () => {
    expect(refs("UPDATE users u SET | WHERE true")).toEqual([["u", "users"]])
    expect(refs("INSERT INTO orders (|) VALUES (1)")).toEqual([
      [null, "orders"],
    ])
    expect(refs("DELETE FROM orders o USING users u WHERE |")).toEqual([
      ["o", "orders"],
      ["u", "users"],
    ])
  })

  it("reads UPDATE ... FROM", () => {
    expect(refs("UPDATE orders o SET total = 0 FROM users u WHERE |")).toEqual([
      ["o", "orders"],
      ["u", "users"],
    ])
  })

  it("skips ONLY, LATERAL and inheritance stars", () => {
    expect(refs("SELECT | FROM ONLY users *, LATERAL orders o")).toEqual([
      [null, "users"],
      ["o", "orders"],
    ])
  })

  it("reads set-returning functions without columns", () => {
    const [entry] = scopeFor("SELECT | FROM generate_series(1, 10) g").entries
    expect(entry.ref).toMatchObject({
      name: "generate_series",
      alias: "g",
    })
    expect(entry.columns).toEqual([])
  })

  it("ignores FROM inside function calls and IS DISTINCT FROM", () => {
    expect(
      refs(
        "SELECT extract(year FROM created_at), | FROM users WHERE a IS DISTINCT FROM b",
      ),
    ).toEqual([[null, "users"]])
  })

  it("reads FROM after SELECT DISTINCT and IS NOT DISTINCT FROM", () => {
    expect(refs("SELECT DISTINCT | FROM users")).toEqual([[null, "users"]])
    expect(refs("SELECT | FROM users WHERE a IS NOT DISTINCT FROM b")).toEqual([
      [null, "users"],
    ])
  })

  it("flags the INSERT target", () => {
    const entries = scopeFor(
      "INSERT INTO orders (user_id) SELECT | FROM users",
    ).entries
    expect(entries.map((e) => [e.ref.name, !!e.ref.insertTarget])).toEqual([
      ["orders", true],
      ["users", false],
    ])
  })

  it("does not read JOIN ... USING (cols) as tables", () => {
    expect(refs("SELECT | FROM orders JOIN order_items USING (id)")).toEqual([
      [null, "orders"],
      [null, "order_items"],
    ])
  })

  it("survives incomplete statements", () => {
    expect(refs("SELECT | FROM users u JOIN")).toEqual([["u", "users"]])
    expect(refs("SELECT | FROM users u JOIN orders o ON")).toEqual([
      ["u", "users"],
      ["o", "orders"],
    ])
    expect(refs("SELECT | FROM")).toEqual([])
  })
})

describe("column resolution", () => {
  it("resolves columns from the database schema", () => {
    expect(describeScope("SELECT | FROM products p")).toEqual([
      "p->products@0: id,name,price",
    ])
  })

  it("resolves unquoted names case-insensitively", () => {
    expect(describeScope("SELECT | FROM PRODUCTS")).toEqual([
      "-->PRODUCTS@0: id,name,price",
    ])
  })

  it("leaves unknown tables without columns", () => {
    expect(describeScope("SELECT | FROM nope n")).toEqual(["n->nope@0: "])
  })

  it("renames columns with a column alias list", () => {
    expect(describeScope("SELECT | FROM products AS p(pid, pname)")).toEqual([
      "p->products@0: pid,pname,price",
    ])
  })
})

describe("derived tables", () => {
  it("exposes the select list of a subquery in FROM", () => {
    expect(
      describeScope(
        "SELECT | FROM (SELECT id, name AS n, count(*) total, now() FROM users) sub",
      ),
    ).toEqual(["sub->sub@0: id,n,total,now"])
  })

  it("expands * and t.* in the subquery", () => {
    expect(describeScope("SELECT | FROM (SELECT * FROM products) a")).toEqual([
      "a->a@0: id,name,price",
    ])
    expect(
      describeScope(
        "SELECT | FROM (SELECT p.*, u.id AS uid FROM products p, users u) a",
      ),
    ).toEqual(["a->a@0: id,name,price,uid"])
  })

  it("keeps column types of plain column references", () => {
    const [entry] = scopeFor(
      "SELECT | FROM (SELECT p.price FROM products p) a",
    ).entries
    expect(entry.columns).toEqual([{ name: "price", data_type: "numeric" }])
  })

  it("skips SELECT DISTINCT ON (...)", () => {
    expect(
      describeScope(
        "SELECT | FROM (SELECT DISTINCT ON (user_id) user_id, total FROM orders) a",
      ),
    ).toEqual(["a->a@0: user_id,total"])
  })
})

describe("CTEs", () => {
  it("resolves a CTE referenced in FROM", () => {
    expect(
      describeScope(
        "WITH big AS (SELECT id, total FROM orders) SELECT | FROM big b",
      ),
    ).toEqual(["b->big@0: id,total"])
  })

  it("lists every CTE of the statement", () => {
    const { ctes } = scopeFor(
      "WITH a AS (SELECT 1 AS x), b AS MATERIALIZED (SELECT y FROM a) SELECT | FROM b",
    )
    expect(
      ctes.map((c) => [c.name, c.columns?.map((col) => col.name)]),
    ).toEqual([
      ["a", ["x"]],
      ["b", ["y"]],
    ])
  })

  it("lets a CTE use the previous ones", () => {
    expect(
      describeScope(
        "WITH a AS (SELECT id FROM users), b AS (SELECT * FROM a) SELECT | FROM b",
      ),
    ).toEqual(["-->b@0: id"])
  })

  it("applies the CTE column list", () => {
    expect(
      describeScope("WITH RECURSIVE t(n, m) AS (SELECT 1, 2) SELECT | FROM t"),
    ).toEqual(["-->t@0: n,m"])
  })

  it("makes CTEs visible inside nested subqueries", () => {
    expect(
      describeScope(
        "WITH a AS (SELECT id FROM users) SELECT * FROM t WHERE x IN (SELECT | FROM a)",
      ),
    ).toEqual(["-->a@0: id", "-->t@1: "])
  })

  it("scopes a CTE body to its own tables", () => {
    expect(
      describeScope("WITH a AS (SELECT | FROM users) SELECT * FROM orders"),
    ).toEqual(["-->users@0: id,name,email,created_at"])
  })
})

describe("subquery scope", () => {
  it("includes the outer query for IN / EXISTS / scalar subqueries", () => {
    expect(
      refs(
        "SELECT * FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE |)",
      ),
    ).toEqual([
      ["o", "orders"],
      ["u", "users"],
    ])
    expect(
      scopeFor(
        "SELECT (SELECT | FROM orders o), u.id FROM users u",
      ).entries.map((e) => e.depth),
    ).toEqual([0, 1])
  })

  it("excludes the outer query for derived tables", () => {
    expect(refs("SELECT * FROM users u, (SELECT | FROM orders o) x")).toEqual([
      ["o", "orders"],
    ])
  })

  it("includes the outer query for LATERAL subqueries", () => {
    expect(
      refs("SELECT * FROM users u, LATERAL (SELECT | FROM orders o) x"),
    ).toEqual([
      ["o", "orders"],
      ["u", "users"],
    ])
  })

  it("uses the enclosing query from inside a function call", () => {
    expect(refs("SELECT coalesce(|) FROM users")).toEqual([[null, "users"]])
  })

  it("does not leak tables from the subquery into the outer query", () => {
    expect(
      refs("SELECT | FROM users WHERE id IN (SELECT user_id FROM orders)"),
    ).toEqual([[null, "users"]])
  })
})

describe("findTable", () => {
  it("prefers schemas on the search path", () => {
    const withShadow = {
      ...db,
      tables: [
        ...db.tables,
        { schema: "audit", name: "users", kind: "table" as const, columns: [] },
      ],
    }
    expect(findTable(withShadow, null, "users")?.schema).toBe("public")
    expect(findTable(withShadow, "audit", "users")?.schema).toBe("audit")
  })

  it("falls back to tables outside the search path", () => {
    expect(findTable(db, null, "invoices")?.schema).toBe("billing")
  })

  it("matches quoted names exactly", () => {
    expect(findTable(db, null, "userprofiles", true)).toBeNull()
    expect(findTable(db, null, "UserProfiles", true)?.name).toBe("UserProfiles")
  })

  it("returns null without a schema", () => {
    expect(findTable(null, null, "users")).toBeNull()
  })
})
