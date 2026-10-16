import { describe, expect, it } from "vitest"
import { changesSchema } from "../../../src/sql/completion"
import {
  FUNCTIONS,
  STATEMENT_KEYWORDS,
} from "../../../src/sql/completion/keywords"
import { columnsOf, complete, suggest } from "./fixtures"

const USERS = columnsOf("users")
const ORDERS = columnsOf("orders")
const PUBLIC_TABLES = [
  "users",
  "orders",
  "order_items",
  "products",
  "active_users",
  "UserProfiles",
]

describe("statement start", () => {
  it("suggests statement keywords in an empty editor", () => {
    expect(suggest("|").keywords).toEqual(STATEMENT_KEYWORDS)
  })

  it("suggests statement keywords while typing the first word", () => {
    const s = suggest("SEL|")
    expect(s.keywords).toEqual(STATEMENT_KEYWORDS)
    expect(s.columns).toEqual([])
  })

  it("follows the case the user is typing in", () => {
    expect(suggest("sel|").keywords).toContain("select")
    expect(suggest("Sel|").keywords).toContain("SELECT")
  })

  it("suggests statement keywords for a new statement after `;`", () => {
    expect(suggest("SELECT * FROM users; |").keywords).toEqual(
      STATEMENT_KEYWORDS,
    )
  })

  it("suggests statement keywords for a new statement after a blank line", () => {
    expect(suggest("SELECT * FROM users\n\n|").keywords).toEqual(
      STATEMENT_KEYWORDS,
    )
  })

  it("suggests the second word of multi-word statements", () => {
    expect(suggest("INSERT |").keywords).toEqual(["INTO"])
    expect(suggest("DELETE |").keywords).toEqual(["FROM"])
  })
})

describe("SELECT list", () => {
  it("suggests columns of the FROM table that comes after the cursor", () => {
    const s = suggest("SELECT | FROM users")
    expect(s.columns).toEqual(USERS)
    expect(s.functions).toEqual(FUNCTIONS)
    expect(s.keywords).toContain("DISTINCT")
  })

  it("suggests columns while typing a column name", () => {
    expect(suggest("SELECT na| FROM users").columns).toEqual(USERS)
  })

  it("suggests columns after a comma", () => {
    expect(suggest("SELECT id, | FROM users").columns).toEqual(USERS)
    expect(suggest("SELECT id,| FROM users").columns).toEqual(USERS)
  })

  it("suggests columns of every joined table", () => {
    const s = suggest("SELECT | FROM users u JOIN orders o ON o.user_id = u.id")
    expect(s.qualifiedColumns).toEqual([
      ...USERS.map((c) => `u.${c}`),
      ...ORDERS.map((c) => `o.${c}`),
    ])
    expect(s.aliases).toEqual(["u", "o"])
  })

  it("qualifies columns that exist in more than one table", () => {
    const { items } = complete(
      "SELECT | FROM users u JOIN orders o ON o.user_id = u.id",
    )
    const insert = (label: string, description: string) =>
      items.find((i) => i.label === label && i.description === description)
        ?.insertText

    expect(insert("id", "u")).toBe("u.id")
    expect(insert("id", "o")).toBe("o.id")
    expect(insert("email", "u")).toBe("email")
    expect(insert("total", "o")).toBe("total")
  })

  it("suggests nothing but functions and keywords without a FROM", () => {
    const s = suggest("SELECT |")
    expect(s.columns).toEqual([])
    expect(s.functions).toEqual(FUNCTIONS)
  })

  it("suggests FROM / AS after a select item", () => {
    expect(suggest("SELECT id |").keywords).toEqual(["FROM", "AS"])
    expect(suggest("SELECT * |").keywords).toEqual(["FROM", "AS"])
    expect(suggest("SELECT count(*) |").keywords).toEqual(["FROM", "AS"])
  })

  it("keeps suggesting columns after an operator inside the select list", () => {
    expect(suggest("SELECT total * | FROM orders").columns).toEqual(ORDERS)
  })

  it("suggests nothing while naming an alias", () => {
    expect(suggest("SELECT id AS | FROM users").all).toEqual([])
  })

  it("suggests columns after DISTINCT", () => {
    expect(suggest("SELECT DISTINCT | FROM users").columns).toEqual(USERS)
  })

  it("suggests nothing after a cast operator", () => {
    expect(suggest("SELECT id::| FROM users").all).toEqual([])
  })
})

describe("FROM and JOIN", () => {
  it("suggests tables, views and other schemas after FROM", () => {
    const s = suggest("SELECT * FROM |")
    expect(s.tables).toEqual([...PUBLIC_TABLES, "billing.invoices"])
    expect(s.schemas).toEqual(["billing"])
    expect(s.columns).toEqual([])
    expect(s.keywords).toEqual([])
  })

  it("marks views apart from tables", () => {
    const { items } = complete("SELECT * FROM |")
    expect(items.find((i) => i.label === "active_users")).toMatchObject({
      kind: "view",
      detail: "view",
    })
  })

  it("quotes tables that need it and qualifies other schemas", () => {
    const { items } = complete("SELECT * FROM |")
    const insert = (label: string) =>
      items.find((i) => i.label === label)?.insertText
    expect(insert("UserProfiles")).toBe('"UserProfiles"')
    expect(insert("billing.invoices")).toBe("billing.invoices")
    expect(insert("users")).toBe("users")
  })

  it("suggests tables while typing a table name", () => {
    expect(suggest("SELECT * FROM us|").tables).toContain("users")
  })

  it("suggests tables after a comma in FROM", () => {
    expect(suggest("SELECT * FROM users u, |").tables).toContain("orders")
  })

  it("suggests tables after every kind of JOIN", () => {
    for (const join of [
      "JOIN",
      "INNER JOIN",
      "LEFT JOIN",
      "LEFT OUTER JOIN",
      "CROSS JOIN",
      "FULL JOIN",
    ]) {
      expect(suggest(`SELECT * FROM users u ${join} |`).tables).toContain(
        "orders",
      )
    }
  })

  it("completes a join keyword started with LEFT / INNER", () => {
    expect(suggest("SELECT * FROM users u LEFT |").keywords).toEqual([
      "JOIN",
      "OUTER JOIN",
    ])
    expect(suggest("SELECT * FROM users u INNER |").keywords).toEqual(["JOIN"])
  })

  it("suggests clause keywords after a table", () => {
    const s = suggest("SELECT * FROM users |")
    expect(s.keywords).toEqual(
      expect.arrayContaining([
        "WHERE",
        "JOIN",
        "LEFT JOIN",
        "GROUP BY",
        "ORDER BY",
        "LIMIT",
      ]),
    )
    expect(s.tables).toEqual([])
  })

  it("suggests clause keywords after an alias", () => {
    expect(suggest("SELECT * FROM users u |").keywords).toContain("WHERE")
  })

  it("suggests ON / USING after a joined table", () => {
    expect(suggest("SELECT * FROM users u JOIN orders o |").keywords).toEqual(
      expect.arrayContaining(["ON", "USING", "WHERE"]),
    )
  })

  it("suggests the tables of a schema after `schema.`", () => {
    const s = suggest("SELECT * FROM billing.|")
    expect(s.tables).toEqual(["invoices"])
    expect(s.items[0].insertText).toBe("invoices")
  })

  it("suggests CTEs as tables", () => {
    const s = suggest("WITH recent AS (SELECT * FROM orders) SELECT * FROM |")
    expect(s.tables[0]).toBe("recent")
    expect(s.items[0]).toMatchObject({ kind: "cte", detail: "CTE" })
  })

  it("suggests a subquery keyword after an opening paren in FROM", () => {
    expect(suggest("SELECT * FROM (|").keywords).toEqual([
      "SELECT",
      "WITH",
      "VALUES",
    ])
  })

  it("only suggests CTEs without a database schema", () => {
    expect(
      suggest("WITH r AS (SELECT 1) SELECT * FROM |", null).tables,
    ).toEqual(["r"])
    expect(suggest("SELECT * FROM |", null).all).toEqual([])
  })
})

describe("JOIN conditions", () => {
  it("suggests columns of all joined tables after ON", () => {
    const s = suggest("SELECT * FROM users u JOIN orders o ON |")
    expect(s.qualifiedColumns).toEqual([
      ...USERS.map((c) => `u.${c}`),
      ...ORDERS.map((c) => `o.${c}`),
    ])
  })

  it("suggests columns on the other side of the comparison", () => {
    expect(
      suggest("SELECT * FROM users u JOIN orders o ON o.user_id = |").columns,
    ).toHaveLength(USERS.length + ORDERS.length)
  })

  it("suggests alias columns after `alias.` in ON", () => {
    expect(
      suggest("SELECT * FROM users u JOIN orders o ON o.user_id = u.|").columns,
    ).toEqual(USERS)
  })

  it("suggests columns inside JOIN ... USING (...)", () => {
    expect(
      suggest("SELECT * FROM orders JOIN order_items USING (|)").columns,
    ).toEqual([...ORDERS, ...columnsOf("order_items")])
  })

  it("suggests the next join or WHERE after a condition", () => {
    expect(
      suggest("SELECT * FROM users u JOIN orders o ON o.user_id = u.id |")
        .keywords,
    ).toEqual(expect.arrayContaining(["AND", "OR", "LEFT JOIN", "WHERE"]))
  })
})

describe("WHERE", () => {
  it("suggests columns and functions", () => {
    const s = suggest("SELECT * FROM users WHERE |")
    expect(s.columns).toEqual(USERS)
    expect(s.functions).toEqual(FUNCTIONS)
    expect(s.keywords).toEqual(expect.arrayContaining(["NOT", "EXISTS"]))
  })

  it("suggests columns after AND / OR / NOT", () => {
    expect(suggest("SELECT * FROM users WHERE id = 1 AND |").columns).toEqual(
      USERS,
    )
    expect(suggest("SELECT * FROM users WHERE id = 1 OR |").columns).toEqual(
      USERS,
    )
    expect(suggest("SELECT * FROM users WHERE NOT |").columns).toEqual(USERS)
  })

  it("suggests predicates and following clauses after an expression", () => {
    const s = suggest("SELECT * FROM users WHERE id = 1 |")
    expect(s.keywords).toEqual(
      expect.arrayContaining([
        "AND",
        "OR",
        "IN",
        "LIKE",
        "IS NULL",
        "ORDER BY",
        "LIMIT",
      ]),
    )
    expect(s.columns).toEqual([])
  })

  it("completes IS", () => {
    expect(suggest("SELECT * FROM users WHERE email IS |").keywords).toEqual([
      "NULL",
      "NOT NULL",
      "TRUE",
      "FALSE",
      "DISTINCT FROM",
    ])
  })

  it("suggests columns inside a function call", () => {
    expect(suggest("SELECT * FROM users WHERE lower(|) = 'a'").columns).toEqual(
      USERS,
    )
  })

  it("suggests columns inside parenthesized conditions", () => {
    expect(suggest("SELECT * FROM users WHERE (id = 1 OR |)").columns).toEqual(
      USERS,
    )
  })

  it("suggests columns and SELECT inside IN (...)", () => {
    const s = suggest("SELECT * FROM users WHERE id IN (|)")
    expect(s.columns).toEqual(USERS)
    expect(s.keywords).toContain("SELECT")
  })

  it("suggests nothing inside a string", () => {
    expect(suggest("SELECT * FROM users WHERE name = 'jo|'").all).toEqual([])
    expect(suggest("SELECT * FROM users WHERE name = 'jo|").all).toEqual([])
  })

  it("suggests nothing inside a comment", () => {
    expect(suggest("SELECT * FROM users -- filter by |").all).toEqual([])
    expect(suggest("SELECT * FROM users /* | */").all).toEqual([])
  })

  it("suggests again right after a closed comment or string", () => {
    expect(suggest("SELECT * FROM users WHERE /* c */ |").columns).toEqual(
      USERS,
    )
    expect(
      suggest("SELECT * FROM users WHERE name = 'x' AND |").columns,
    ).toEqual(USERS)
  })

  it("ignores comments between the clause and the cursor", () => {
    expect(suggest("SELECT * FROM users WHERE -- note\n |").columns).toEqual(
      USERS,
    )
  })
})

describe("qualified columns (dot access)", () => {
  it("suggests only the alias' columns", () => {
    const s = suggest("SELECT u.| FROM users u JOIN orders o ON true")
    expect(s.columns).toEqual(USERS)
    expect(s.functions).toEqual([])
    expect(s.keywords).toEqual([])
  })

  it("suggests only the alias' columns in WHERE", () => {
    expect(suggest("select * from users u where u.|").all).toEqual(USERS)
    expect(suggest("select * from users as u where u.|").all).toEqual(USERS)
    expect(
      suggest(
        "select * from users u join orders o on o.user_id = u.id where u.|",
      ).all,
    ).toEqual(USERS)
  })

  it("filters with the partial word after the dot", () => {
    const r = complete("SELECT o.us| FROM users u JOIN orders o ON true")
    expect(r.items.map((i) => i.label)).toEqual(ORDERS)
    expect(r.replaceStart).toBe("SELECT o.".length)
  })

  it("inserts columns unqualified after the dot", () => {
    const { items } = complete("SELECT o.| FROM users u JOIN orders o ON true")
    expect(items.find((i) => i.label === "id")?.insertText).toBe("id")
  })

  it("accepts the table name when there is no alias", () => {
    expect(suggest("SELECT orders.| FROM orders").columns).toEqual(ORDERS)
  })

  it("matches aliases case-insensitively", () => {
    expect(suggest("SELECT U.| FROM users u").columns).toEqual(USERS)
  })

  it("suggests a table's columns before it is in the FROM", () => {
    expect(suggest("SELECT products.|").columns).toEqual(columnsOf("products"))
  })

  it("suggests columns of a schema-qualified table", () => {
    expect(
      suggest("SELECT billing.invoices.| FROM billing.invoices").columns,
    ).toEqual(columnsOf("invoices"))
  })

  it("suggests columns of a CTE", () => {
    expect(
      suggest(
        "WITH r AS (SELECT id, total AS amount FROM orders) SELECT r.| FROM r",
      ).columns,
    ).toEqual(["id", "amount"])
  })

  it("suggests columns of a derived table", () => {
    expect(
      suggest(
        "SELECT s.| FROM (SELECT name, count(*) AS n FROM users GROUP BY name) s",
      ).columns,
    ).toEqual(["name", "n"])
  })

  it("quotes columns that need it", () => {
    const { items } = complete('SELECT p.| FROM "UserProfiles" p')
    expect(items.map((i) => i.insertText)).toEqual(["id", '"Display Name"'])
  })

  it("suggests nothing for an unknown qualifier", () => {
    expect(suggest("SELECT x.| FROM users u").all).toEqual([])
  })

  it("triggers on its own", () => {
    expect(complete("SELECT u.| FROM users u").autoTrigger).toBe(true)
  })
})

describe("GROUP BY / HAVING / ORDER BY / LIMIT", () => {
  it("suggests columns after GROUP BY and ORDER BY", () => {
    expect(suggest("SELECT * FROM orders GROUP BY |").columns).toEqual(ORDERS)
    expect(suggest("SELECT * FROM orders ORDER BY |").columns).toEqual(ORDERS)
    expect(
      suggest("SELECT * FROM orders ORDER BY total DESC, |").columns,
    ).toEqual(ORDERS)
  })

  it("completes BY", () => {
    expect(suggest("SELECT * FROM orders GROUP |").keywords).toEqual(["BY"])
    expect(suggest("SELECT * FROM orders ORDER |").keywords).toEqual(["BY"])
  })

  it("suggests the next clauses after a GROUP BY item", () => {
    expect(suggest("SELECT * FROM orders GROUP BY status |").keywords).toEqual([
      "HAVING",
      "ORDER BY",
      "LIMIT",
    ])
  })

  it("suggests columns and aggregates in HAVING", () => {
    const s = suggest("SELECT status FROM orders GROUP BY status HAVING |")
    expect(s.columns).toEqual(ORDERS)
    expect(s.functions).toContain("count")
  })

  it("suggests sort modifiers after an ORDER BY item", () => {
    expect(suggest("SELECT * FROM orders ORDER BY total |").keywords).toEqual([
      "ASC",
      "DESC",
      "NULLS FIRST",
      "NULLS LAST",
      "LIMIT",
      "OFFSET",
    ])
    expect(
      suggest("SELECT * FROM orders ORDER BY total DESC NULLS |").keywords,
    ).toEqual(["FIRST", "LAST"])
  })

  it("suggests nothing for a LIMIT value and OFFSET after it", () => {
    expect(suggest("SELECT * FROM orders LIMIT |").all).toEqual([])
    expect(suggest("SELECT * FROM orders LIMIT 10 |").keywords).toEqual([
      "OFFSET",
    ])
  })

  it("suggests window clauses inside OVER (...)", () => {
    const s = suggest("SELECT row_number() OVER (|) FROM orders")
    expect(s.keywords).toEqual(
      expect.arrayContaining(["PARTITION BY", "ORDER BY"]),
    )
    expect(s.columns).toEqual(ORDERS)
    expect(
      suggest("SELECT row_number() OVER (PARTITION BY |) FROM orders").columns,
    ).toEqual(ORDERS)
  })
})

describe("editing in the middle of a query", () => {
  it("adds a column to the select list of a finished query", () => {
    expect(
      suggest("SELECT id, |, email FROM users WHERE id = 1 ORDER BY name")
        .columns,
    ).toEqual(USERS)
  })

  it("adds a condition between WHERE and ORDER BY", () => {
    expect(
      suggest("SELECT * FROM users u WHERE u.id = 1 AND | ORDER BY u.name")
        .columns,
    ).toEqual(USERS)
  })

  it("replaces a table in the middle of the FROM", () => {
    const r = complete("SELECT * FROM us| WHERE id = 1")
    expect(r.items.map((i) => i.label)).toContain("users")
    expect([r.replaceStart, r.replaceEnd]).toEqual([14, 16])
  })

  it("replaces the whole word when the cursor is inside it", () => {
    const r = complete("SELECT na|me FROM users")
    expect(r.items.map((i) => i.label)).toEqual(expect.arrayContaining(USERS))
    expect([r.replaceStart, r.replaceEnd]).toEqual([7, 11])
  })

  it("uses tables joined after the cursor", () => {
    const s = suggest(
      "SELECT u.name, o.| FROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE u.id = 1",
    )
    expect(s.columns).toEqual(ORDERS)
  })

  it("adds a JOIN before the WHERE", () => {
    expect(
      suggest("SELECT * FROM users u | WHERE u.id = 1").keywords,
    ).toContain("LEFT JOIN")
    expect(
      suggest("SELECT * FROM users u LEFT JOIN | WHERE u.id = 1").tables,
    ).toContain("orders")
  })

  it("only looks at the statement under the cursor", () => {
    const sql =
      "SELECT * FROM orders;\nSELECT | FROM users;\nSELECT * FROM products"
    expect(suggest(sql).columns).toEqual(USERS)
  })

  it("only looks at the statement under the cursor with blank-line separators", () => {
    const sql =
      "SELECT * FROM orders\n\nSELECT | FROM users\n\nSELECT * FROM products"
    expect(suggest(sql).columns).toEqual(USERS)
  })

  it("handles multi-line formatted queries", () => {
    const sql = `SELECT
  u.id,
  |
FROM
  users u
  LEFT JOIN orders o ON o.user_id = u.id
WHERE
  o.total > 100`
    expect(suggest(sql).aliases).toEqual(["u", "o"])
  })
})

describe("subqueries", () => {
  it("suggests the inner tables first, then the outer ones", () => {
    const s = suggest(
      "SELECT * FROM users u WHERE u.id IN (SELECT user_id FROM orders WHERE |)",
    )
    expect(s.qualifiedColumns).toEqual([
      ...ORDERS.map((c) => `orders.${c}`),
      ...USERS.map((c) => `u.${c}`),
    ])
    const ranks = s.items
      .filter((i) => i.kind === "column")
      .map((i) => i.sortText[0])
    expect(new Set(ranks.slice(0, ORDERS.length))).toEqual(new Set(["0"]))
    expect(new Set(ranks.slice(ORDERS.length))).toEqual(new Set(["3"]))
  })

  it("does not qualify columns that collide only with the outer query", () => {
    const { items } = complete(
      "SELECT * FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE |)",
    )
    expect(
      items.find((i) => i.label === "id" && i.description === "o")?.insertText,
    ).toBe("id")
  })

  it("suggests the subquery's columns in its select list", () => {
    expect(
      suggest(
        "SELECT * FROM users WHERE id IN (SELECT | FROM orders)",
      ).columns.slice(0, 5),
    ).toEqual(ORDERS)
  })

  it("suggests tables in a subquery FROM", () => {
    expect(
      suggest("SELECT * FROM users WHERE id IN (SELECT user_id FROM |)").tables,
    ).toContain("orders")
  })

  it("suggests a derived table's columns in the outer query", () => {
    expect(
      suggest("SELECT | FROM (SELECT id, total FROM orders) t")
        .qualifiedColumns,
    ).toEqual(["t.id", "t.total"])
  })

  it("does not see outer tables from a derived table", () => {
    expect(
      suggest("SELECT * FROM users u, (SELECT | FROM orders) t").columns,
    ).toEqual(ORDERS)
  })

  it("works inside an unclosed subquery", () => {
    expect(
      suggest(
        "SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE |",
      ).columns,
    ).toContain("status")
  })

  it("suggests columns in a scalar subquery of the select list", () => {
    const s = suggest(
      "SELECT u.name, (SELECT count(*) FROM orders o WHERE o.user_id = |) FROM users u",
    )
    expect(s.aliases).toEqual(["o", "u"])
  })
})

describe("CTEs", () => {
  it("suggests nothing while naming a CTE", () => {
    expect(suggest("WITH |").all).toEqual([])
  })

  it("suggests a subquery keyword for the CTE body", () => {
    expect(suggest("WITH x AS (|").keywords).toEqual([
      "SELECT",
      "WITH",
      "VALUES",
    ])
  })

  it("suggests the main statement after the CTEs", () => {
    expect(suggest("WITH x AS (SELECT 1) |").keywords).toEqual(
      expect.arrayContaining([
        "SELECT",
        "INSERT INTO",
        "UPDATE",
        "DELETE FROM",
      ]),
    )
  })

  it("suggests columns inside the CTE body", () => {
    expect(
      suggest("WITH x AS (SELECT | FROM orders) SELECT * FROM x").columns,
    ).toEqual(ORDERS)
  })

  it("suggests CTE columns in the main query", () => {
    expect(
      suggest("WITH x AS (SELECT id, status FROM orders) SELECT | FROM x")
        .columns,
    ).toEqual(["id", "status"])
  })
})

describe("INSERT", () => {
  it("suggests tables after INSERT INTO", () => {
    expect(suggest("INSERT INTO |").tables).toEqual(
      expect.arrayContaining(["users", "orders"]),
    )
  })

  it("suggests only the target's columns in the column list", () => {
    expect(suggest("INSERT INTO orders (|)").columns).toEqual(ORDERS)
    expect(suggest("INSERT INTO orders (id, |)").columns).toEqual(ORDERS)
    expect(suggest("INSERT INTO orders (id, |) VALUES (1, 2)").columns).toEqual(
      ORDERS,
    )
  })

  it("suggests columns of a schema-qualified target", () => {
    expect(suggest("INSERT INTO billing.invoices (|)").columns).toEqual(
      columnsOf("invoices"),
    )
  })

  it("suggests VALUES / SELECT after the column list", () => {
    expect(suggest("INSERT INTO orders (id, total) |").keywords).toEqual([
      "VALUES",
      "SELECT",
      "DEFAULT VALUES",
    ])
    expect(suggest("INSERT INTO orders |").keywords).toEqual([
      "VALUES",
      "SELECT",
      "DEFAULT VALUES",
    ])
  })

  it("suggests functions and literals inside VALUES, not columns", () => {
    const s = suggest(
      "INSERT INTO orders (id, created_at) VALUES (gen_random_uuid(), |)",
    )
    expect(s.columns).toEqual([])
    expect(s.functions).toContain("now")
    expect(s.keywords).toEqual(["DEFAULT", "NULL", "TRUE", "FALSE"])
  })

  it("suggests ON CONFLICT / RETURNING after VALUES", () => {
    expect(suggest("INSERT INTO orders (id) VALUES (1) |").keywords).toEqual([
      "ON CONFLICT",
      "RETURNING",
    ])
  })

  it("suggests target columns in ON CONFLICT (...) and DO UPDATE SET", () => {
    expect(
      suggest("INSERT INTO orders (id) VALUES (1) ON CONFLICT (|)").columns,
    ).toEqual(ORDERS)
    expect(
      suggest("INSERT INTO orders (id) VALUES (1) ON CONFLICT |").keywords,
    ).toEqual(["DO NOTHING", "DO UPDATE SET"])
    expect(
      suggest(
        "INSERT INTO orders (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET |",
      ).columns,
    ).toEqual(ORDERS)
  })

  it("suggests the source's columns in INSERT ... SELECT", () => {
    expect(
      suggest("INSERT INTO orders (user_id) SELECT | FROM users").columns,
    ).toEqual(USERS)
  })

  it("suggests target columns in RETURNING", () => {
    expect(
      suggest("INSERT INTO orders (id) VALUES (1) RETURNING |").columns,
    ).toEqual(ORDERS)
  })
})

describe("UPDATE", () => {
  it("suggests tables after UPDATE", () => {
    expect(suggest("UPDATE |").tables).toContain("users")
  })

  it("suggests SET after the table", () => {
    expect(suggest("UPDATE users |").keywords).toEqual(["SET"])
    expect(suggest("UPDATE users u |").keywords).toEqual(["SET"])
  })

  it("suggests the target's columns to assign", () => {
    expect(suggest("UPDATE users SET |").columns).toEqual(USERS)
    expect(suggest("UPDATE users SET name = 'a', |").columns).toEqual(USERS)
  })

  it("only suggests target columns to assign even with UPDATE ... FROM", () => {
    expect(
      suggest("UPDATE orders o SET | FROM users u WHERE u.id = o.user_id")
        .columns,
    ).toEqual(ORDERS)
  })

  it("suggests every table's columns on the right-hand side", () => {
    expect(
      suggest("UPDATE orders o SET total = | FROM users u").aliases,
    ).toEqual(["o", "u"])
  })

  it("suggests WHERE after an assignment", () => {
    expect(suggest("UPDATE users SET name = 'a' |").keywords).toEqual([
      "WHERE",
      "FROM",
      "RETURNING",
    ])
  })

  it("suggests columns in WHERE", () => {
    expect(suggest("UPDATE users SET name = 'a' WHERE |").columns).toEqual(
      USERS,
    )
  })
})

describe("DELETE", () => {
  it("suggests tables after DELETE FROM", () => {
    expect(suggest("DELETE FROM |").tables).toContain("orders")
  })

  it("suggests columns in WHERE", () => {
    expect(suggest("DELETE FROM orders WHERE |").columns).toEqual(ORDERS)
  })

  it("suggests columns of USING tables", () => {
    expect(
      suggest("DELETE FROM orders o USING users u WHERE |").aliases,
    ).toEqual(["o", "u"])
  })
})

describe("other statements", () => {
  it("suggests tables after TRUNCATE / ALTER TABLE / DROP TABLE", () => {
    expect(suggest("TRUNCATE |").tables).toContain("users")
    expect(suggest("TRUNCATE TABLE |").tables).toContain("users")
    expect(suggest("ALTER TABLE |").tables).toContain("users")
    expect(suggest("DROP TABLE |").tables).toContain("users")
  })

  it("suggests statements after EXPLAIN", () => {
    expect(suggest("EXPLAIN |").keywords).toEqual(
      expect.arrayContaining(["ANALYZE", "SELECT"]),
    )
  })

  it("suggests SELECT after UNION", () => {
    expect(suggest("SELECT id FROM users UNION |").keywords).toEqual([
      "SELECT",
      "ALL",
    ])
  })

  it("scopes each side of a UNION to its own tables", () => {
    expect(
      suggest("SELECT id FROM users UNION SELECT | FROM orders").columns,
    ).toEqual(expect.arrayContaining(ORDERS))
  })
})

describe("quoted identifiers", () => {
  it("suggests tables while typing a quoted name", () => {
    const r = complete('SELECT * FROM "User|')
    expect(r.items.map((i) => i.label)).toContain("UserProfiles")
    expect(r.replaceStart).toBe(14)
  })

  it("resolves quoted aliases and tables", () => {
    expect(suggest('SELECT "p".| FROM "UserProfiles" "p"').columns).toEqual([
      "id",
      "Display Name",
    ])
  })
})

describe("items", () => {
  it("shows the column type and its table", () => {
    const { items } = complete("SELECT | FROM orders o")
    expect(items.find((i) => i.label === "total")).toMatchObject({
      kind: "column",
      detail: "numeric(10,2)",
      description: "o",
    })
  })

  it("inserts functions as snippets with the cursor inside the parens", () => {
    const { items } = complete("SELECT | FROM orders")
    expect(items.find((i) => i.label === "count")).toMatchObject({
      insertText: "count($0)",
      isSnippet: true,
    })
  })

  it("ranks columns before functions and keywords", () => {
    const { items } = complete("SELECT | FROM orders")
    const rank = (kind: string) => items.find((i) => i.kind === kind)!.sortText
    expect(rank("column") < rank("alias")).toBe(true)
    expect(rank("alias") < rank("function")).toBe(true)
    expect(rank("function") < rank("keyword")).toBe(true)
  })

  it("ranks the search path before other schemas", () => {
    const { items } = complete("SELECT * FROM |")
    const rank = (label: string) =>
      items.find((i) => i.label === label)!.sortText
    expect(rank("orders") < rank("billing.invoices")).toBe(true)
  })

  it("does not repeat the same table referenced twice", () => {
    const s = suggest("SELECT | FROM users u JOIN users u ON true")
    expect(s.aliases).toEqual(["u"])
  })
})

describe("auto trigger", () => {
  it("pops up for tables and columns right after a keyword or comma", () => {
    expect(complete("SELECT * FROM |").autoTrigger).toBe(true)
    expect(complete("SELECT | FROM users").autoTrigger).toBe(true)
    expect(complete("SELECT id, | FROM users").autoTrigger).toBe(true)
    expect(complete("SELECT * FROM users WHERE |").autoTrigger).toBe(true)
  })

  it("stays quiet when only keywords would show", () => {
    expect(complete("SELECT * FROM users |").autoTrigger).toBe(false)
    expect(complete("|").autoTrigger).toBe(false)
  })

  it("stays quiet after an operator, where a literal is likely", () => {
    expect(complete("SELECT * FROM users WHERE id = |").autoTrigger).toBe(false)
  })
})

describe("robustness", () => {
  const inputs = [
    "(((",
    ")))",
    "SELECT ((((|",
    "SELECT * FROM users WHERE id IN ((SELECT |",
    "'unterminated |",
    '"unterminated |',
    "SELECT . . . |",
    "SELECT ,,, | FROM ,,",
    "WITH WITH WITH |",
    "SELECT * FROM users u JOIN JOIN ON ON |",
    "INSERT INTO (|",
    "UPDATE SET SET |",
    ";;;|;;;",
    "SELECT $1, $$ |",
  ]

  it.each(inputs)("does not throw on %j", (input) => {
    const sql = input.includes("|") ? input : `${input}|`
    expect(() => complete(sql)).not.toThrow()
  })

  it("handles every cursor position of a large statement", () => {
    const sql = `WITH t AS (SELECT u.id, count(o.id) AS n FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id)
SELECT t.*, (SELECT max(total) FROM orders WHERE user_id = t.id) FROM t WHERE t.n > 1 AND EXISTS (SELECT 1) ORDER BY 2 DESC LIMIT 5;
INSERT INTO orders (id, user_id) VALUES (gen_random_uuid(), 'x') ON CONFLICT (id) DO UPDATE SET total = 0 RETURNING *;
UPDATE users SET name = 'a' WHERE id = 'b'; DELETE FROM orders USING users WHERE true`
    for (let offset = 0; offset <= sql.length; offset++) {
      expect(() =>
        complete(`${sql.slice(0, offset)}|${sql.slice(offset)}`),
      ).not.toThrow()
    }
  })
})

describe("changesSchema", () => {
  it("detects statements that change the visible schema", () => {
    expect(changesSchema("create table t (id int)")).toBe(true)
    expect(changesSchema("-- add a column\nALTER TABLE t ADD c int")).toBe(true)
    expect(changesSchema("SELECT 1; DROP TABLE t")).toBe(true)
    expect(changesSchema("GRANT SELECT ON t TO r")).toBe(true)
  })

  it("ignores queries and data changes", () => {
    expect(changesSchema("SELECT 'create table'")).toBe(false)
    expect(changesSchema("UPDATE t SET a = 1")).toBe(false)
  })
})
