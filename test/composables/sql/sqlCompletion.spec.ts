import { describe, it, expect } from "vitest"
import { getSqlSuggestions } from "../../../src/composables/sql/sqlSuggestions"
import * as sqlKeywords from "../../../src/composables/sql/sqlKeywords"

const mockSchema = {
  users: ["id", "name", "email"],
  orders: ["id", "user_id", "total"],
}

const tables = Object.keys(mockSchema)
const columns = Object.values(mockSchema).flat()

describe("SQL Auto-Completion Engine", () => {
  it("suggests statements when query is empty", () => {
    assertSuggestionLabels("", 0, sqlKeywords.STATEMENT_KEYWORDS)
  })

  it("suggests columns and functions keywords after SELECT", () => {
    const expected = [
      ...columns,
      ...sqlKeywords.ALL_FUNCTIONS
    ]

    const query = "SELECT "
    assertSuggestionLabels(query, query.length, expected)
  })

  it("suggests caluses after select columns", () => {
    const query = "SELECT * "
    const expected = sqlKeywords.CLAUSE_KEYWORDS
    assertSuggestionLabels(query, query.length, expected)
  })

  it("suggests caluses after select columns 2", () => {
    const query = "SELECT id "
    const expected = sqlKeywords.CLAUSE_KEYWORDS
    assertSuggestionLabels(query, query.length, expected)
  })

  it("filters suggestions by current word (e.g. 'f' -> 'FROM')", () => {
    const query = "SELECT * f"
    const expected = sqlKeywords.CLAUSE_KEYWORDS.filter((kw) => kw.startsWith("F"))
    assertSuggestionLabels(query, query.length, expected)
  })

  it("suggests tables after FROM", () => {
    const query = "SELECT * FROM "
    assertSuggestionLabels(query, query.length, tables)
  })

  it("suggests caluses after select table", () => {
    const query = "SELECT * FROM users "
    const expected = sqlKeywords.CLAUSE_KEYWORDS
    assertSuggestionLabels(query, query.length, expected)
  })

  it("suggests relevant columns when table alias is used with dot", () => {
    const query = "SELECT * FROM users u WHERE u."
    assertSuggestionLabels(query, query.length, mockSchema.users)
  })

  it("suggests columns from ALL referenced tables in WHERE", () => {
    const query = "SELECT * FROM users u JOIN orders o ON o.user_id = u.id WHERE "
    const expected = [
      ...columns,
      ...sqlKeywords.ALL_FUNCTIONS
    ]
    assertSuggestionLabels(query, query.length, expected)
  })

  // the problem here is that the tokenizer is capping the query at 9 chars
  //  we should analyze all the query to get its full context
  it("suggests columns from users when going back to edit SELECT with dot", () => {
    const query = "SELECT u. FROM users u JOIN orders o ON o.user_id = u.id WHERE "
    assertSuggestionLabels(query, 9, mockSchema.users)
  })
})

function assertSuggestionLabels(sql: string, cursorOffset: number, expected: string[]) {
  const labels = getSqlSuggestions(sql, cursorOffset, mockSchema).map((s) => s.label)
  expect(labels).toEqual(expected)
}

