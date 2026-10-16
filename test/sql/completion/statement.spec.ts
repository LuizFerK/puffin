import { describe, expect, it } from "vitest"
import {
  buildStructure,
  groupAt,
  queryGroupOf,
  splitStatements,
  statementAt,
} from "../../../src/sql/completion/statement"
import { tokenize } from "../../../src/sql/completion/tokenizer"
import { parseCursor } from "./fixtures"

const texts = (sql: string) =>
  splitStatements(sql).map((s) => s.tokens.map((t) => t.value).join(" "))

describe("splitStatements", () => {
  it("splits on semicolons", () => {
    expect(texts("SELECT 1; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2", ""])
  })

  it("splits on blank lines, like the query runner", () => {
    expect(texts("SELECT 1\n\nSELECT 2\n  \t\nSELECT 3")).toEqual([
      "SELECT 1",
      "SELECT 2",
      "SELECT 3",
    ])
  })

  it("keeps a single line break inside the statement", () => {
    expect(texts("SELECT *\nFROM users\nWHERE id = 1")).toEqual([
      "SELECT * FROM users WHERE id = 1",
    ])
  })

  it("ignores separators inside strings and comments", () => {
    expect(texts("SELECT ';' -- ;\n, $$\n\n$$ /* ; */ FROM t")).toEqual([
      "SELECT ';' , $$\n\n$$ FROM t",
    ])
  })

  it("drops comment tokens from statements", () => {
    expect(texts("SELECT /* x */ a -- y")).toEqual(["SELECT a"])
  })
})

describe("statementAt", () => {
  const at = (input: string) => {
    const { sql, offset } = parseCursor(input)
    return statementAt(sql, offset)
      .tokens.map((t) => t.value)
      .join(" ")
  }

  it("picks the statement the cursor is in", () => {
    expect(at("SELECT 1; SELECT | FROM b; SELECT 3")).toBe("SELECT FROM b")
  })

  it("belongs to the previous statement right before the semicolon", () => {
    expect(at("SELECT a|; SELECT b")).toBe("SELECT a")
  })

  it("starts a new, empty statement right after the semicolon", () => {
    expect(at("SELECT a;|")).toBe("")
    expect(at("SELECT a; |")).toBe("")
  })

  it("stays on the statement when the cursor is at the end of its last line", () => {
    expect(at("SELECT a |\n\nSELECT b")).toBe("SELECT a")
  })

  it("does not split on the empty line the cursor is on", () => {
    expect(at("SELECT\n  id,\n  |\nFROM users")).toBe("SELECT id , FROM users")
    expect(at("SELECT\n  id,\n|\nFROM users")).toBe("SELECT id , FROM users")
  })

  it("still splits on other blank lines in the same gap", () => {
    expect(at("SELECT a\n\n  |\nSELECT b")).toBe("SELECT b")
  })

  it("starts a new statement on the line after a blank line", () => {
    expect(at("SELECT a\n\n|")).toBe("")
    expect(at("SELECT a\n\n|\nSELECT b")).toBe("SELECT b")
  })
})

describe("buildStructure", () => {
  const structureOf = (sql: string) => buildStructure(tokenize(sql))

  it("puts the parens in the outer group and their contents in a child group", () => {
    const s = structureOf("SELECT count(id) FROM t")
    const values = (ids: number[]) => ids.map((i) => s.tokens[i].value)

    expect(values(s.groups[0].level)).toEqual([
      "SELECT",
      "count",
      "(",
      ")",
      "FROM",
      "t",
    ])
    expect(values(s.groups[1].level)).toEqual(["id"])
    expect(s.groups[1].parent).toBe(s.groups[0])
  })

  it("flags groups that start with a query as their own scope", () => {
    const s = structureOf(
      "SELECT * FROM (SELECT 1) x WHERE a IN (1, 2) AND b IN (WITH c AS (SELECT 1) SELECT 1)",
    )
    expect(s.groups.map((g) => g.isQuery)).toEqual([
      true,
      true,
      false,
      true,
      true,
    ])
  })

  it("leaves groups open when the closing paren is missing", () => {
    const s = structureOf("SELECT * FROM t WHERE id IN (SELECT")
    expect(s.groups[1].close).toBeNull()
  })

  it("ignores unbalanced closing parens", () => {
    const s = structureOf("SELECT 1) FROM t")
    expect(s.groups).toHaveLength(1)
  })
})

describe("groupAt", () => {
  const groupFor = (input: string) => {
    const { sql, offset } = parseCursor(input)
    const s = buildStructure(tokenize(sql))
    const group = groupAt(s, offset)
    return {
      group,
      s,
      text: group.level.map((i) => s.tokens[i].value).join(" "),
    }
  }

  it("returns the root outside parentheses", () => {
    expect(groupFor("SELECT | FROM t").group.id).toBe(0)
  })

  it("returns the innermost group that encloses the cursor", () => {
    expect(
      groupFor("SELECT * FROM t WHERE a IN (SELECT b FROM c WHERE d = (|))")
        .text,
    ).toBe("")
    expect(
      groupFor("SELECT * FROM t WHERE a IN (SELECT b FROM c WHERE |)").text,
    ).toBe("SELECT b FROM c WHERE")
  })

  it("treats a cursor right after `(` or right before `)` as inside", () => {
    expect(groupFor("SELECT count(|)").group.id).toBe(1)
    expect(groupFor("SELECT count(id|)").group.id).toBe(1)
  })

  it("treats a cursor right after `)` as outside", () => {
    expect(groupFor("SELECT count(id)|").group.id).toBe(0)
  })

  it("reaches the enclosing query from a function call", () => {
    const { group, s } = groupFor("SELECT * FROM (SELECT coalesce(|) FROM t) x")
    expect(queryGroupOf(group)).toBe(s.groups[1])
  })
})
