import { describe, expect, it } from "vitest"
import { tokenize } from "../../../src/sql/completion/tokenizer"

const types = (sql: string) => tokenize(sql).map((t) => [t.type, t.value])

describe("tokenize", () => {
  it("splits words, punctuation and operators, dropping whitespace", () => {
    expect(types("SELECT u.id, count(*) FROM users u WHERE id >= 10")).toEqual([
      ["word", "SELECT"],
      ["word", "u"],
      ["dot", "."],
      ["word", "id"],
      ["comma", ","],
      ["word", "count"],
      ["open", "("],
      ["operator", "*"],
      ["close", ")"],
      ["word", "FROM"],
      ["word", "users"],
      ["word", "u"],
      ["word", "WHERE"],
      ["word", "id"],
      ["operator", ">="],
      ["number", "10"],
    ])
  })

  it("upper-cases words in `upper` and leaves other tokens empty", () => {
    const [select, num] = tokenize("select 1")
    expect(select.upper).toBe("SELECT")
    expect(num.upper).toBe("")
  })

  it("records source offsets", () => {
    const [, users] = tokenize("FROM  users")
    expect(users).toMatchObject({ start: 6, end: 11 })
  })

  it("reads single-quoted strings with escaped quotes as one token", () => {
    expect(types("'it''s' x")).toEqual([
      ["string", "'it''s'"],
      ["word", "x"],
    ])
  })

  it("reads E'' strings and dollar-quoted strings", () => {
    expect(types("E'a\\'b' x")).toEqual([
      ["string", "E'a\\'b'"],
      ["word", "x"],
    ])
    expect(types("$$ a; 'b' $$ $tag$ x $tag$")).toEqual([
      ["string", "$$ a; 'b' $$"],
      ["string", "$tag$ x $tag$"],
    ])
  })

  it("marks unterminated strings, quoted identifiers and block comments as open", () => {
    expect(tokenize("'abc")[0]).toMatchObject({
      type: "string",
      closed: false,
    })
    expect(tokenize('"Abc')[0]).toMatchObject({
      type: "quoted",
      closed: false,
    })
    expect(tokenize("/* abc")[0]).toMatchObject({
      type: "comment",
      closed: false,
    })
    expect(tokenize("$$ abc")[0]).toMatchObject({
      type: "string",
      closed: false,
    })
    expect(tokenize("'abc'")[0].closed).toBe(true)
  })

  it("unquotes double-quoted identifiers", () => {
    expect(types('"User ""X"""."Id"')).toEqual([
      ["quoted", 'User "X"'],
      ["dot", "."],
      ["quoted", "Id"],
    ])
  })

  it("keeps comments as tokens, line comments are never closed", () => {
    expect(
      tokenize("a -- note\nb /* c */ d").map((t) => [t.type, t.closed]),
    ).toEqual([
      ["word", true],
      ["comment", false],
      ["word", true],
      ["comment", true],
      ["word", true],
    ])
  })

  it("does not let an operator swallow a following comment", () => {
    expect(types("a =-- note")).toEqual([
      ["word", "a"],
      ["operator", "="],
      ["comment", "-- note"],
    ])
  })

  it("reads casts, json operators and positional params", () => {
    expect(types("x::int ->> 'k' = $1")).toEqual([
      ["word", "x"],
      ["operator", "::"],
      ["word", "int"],
      ["operator", "->>"],
      ["string", "'k'"],
      ["operator", "="],
      ["param", "$1"],
    ])
  })

  it("reads decimals and exponents as numbers", () => {
    expect(types("1.5 .5 1e10 2.5E-3")).toEqual([
      ["number", "1.5"],
      ["number", ".5"],
      ["number", "1e10"],
      ["number", "2.5E-3"],
    ])
  })

  it("accepts non-ASCII identifiers", () => {
    expect(types("SELECT ação FROM tabela")).toEqual([
      ["word", "SELECT"],
      ["word", "ação"],
      ["word", "FROM"],
      ["word", "tabela"],
    ])
  })
})
