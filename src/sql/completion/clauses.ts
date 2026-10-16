import { isWord, type Token } from "./tokenizer"

export type Clause =
  | "select"
  | "from"
  | "join"
  | "on"
  | "using"
  | "where"
  | "groupBy"
  | "having"
  | "orderBy"
  | "partitionBy"
  | "limit"
  | "update"
  | "doUpdate"
  | "set"
  | "into"
  | "insert"
  | "delete"
  | "values"
  | "returning"
  | "with"
  | "conflict"
  | "setOp"
  | "tableName"

export interface ClauseMatch {
  clause: Clause
  /** Position of the clause keyword in the level array. */
  position: number
}

const SIMPLE_CLAUSES: Record<string, Clause> = {
  SELECT: "select",
  JOIN: "join",
  WHERE: "where",
  HAVING: "having",
  LIMIT: "limit",
  OFFSET: "limit",
  FETCH: "limit",
  SET: "set",
  INTO: "into",
  INSERT: "insert",
  DELETE: "delete",
  VALUES: "values",
  RETURNING: "returning",
  WITH: "with",
  UNION: "setOp",
  INTERSECT: "setOp",
  EXCEPT: "setOp",
  TRUNCATE: "tableName",
}

const BY_CLAUSES: Record<string, Clause> = {
  GROUP: "groupBy",
  ORDER: "orderBy",
  PARTITION: "partitionBy",
}

/** `a IS [NOT] DISTINCT FROM b`: a comparison, not a FROM clause. `p` points at FROM. */
const isDistinctFrom = (lv: Token[], p: number) =>
  isWord(lv[p - 1], "DISTINCT") &&
  (isWord(lv[p - 2], "IS") ||
    (isWord(lv[p - 2], "NOT") && isWord(lv[p - 3], "IS")))

/** Clause introduced by the keyword at `p`, looking at its neighbours for multi-word forms. */
export function clauseOf(lv: Token[], p: number): Clause | null {
  const token = lv[p]
  if (token.type !== "word") return null
  const prev = lv[p - 1]

  switch (token.upper) {
    case "FROM":
      return isDistinctFrom(lv, p) ? null : "from"
    case "BY":
      return (prev?.type === "word" && BY_CLAUSES[prev.upper]) || null
    case "ON":
      if (isWord(prev, "DISTINCT")) return null
      return isWord(lv[p + 1], "CONFLICT") ? "conflict" : "on"
    case "USING":
      return "using"
    case "UPDATE":
      if (isWord(prev, "FOR")) return null
      return isWord(prev, "DO") ? "doUpdate" : "update"
    case "TABLE":
      return isWord(prev, "ALTER", "DROP", "TRUNCATE", "LOCK")
        ? "tableName"
        : null
    default:
      return SIMPLE_CLAUSES[token.upper] ?? null
  }
}

/**
 * Walks a level backwards from `before` (exclusive) and returns the closest clause
 * keyword. Nested parentheses aren't part of the level, so they're skipped for free.
 */
export function clauseAt(lv: Token[], before: number): ClauseMatch | null {
  for (let p = Math.min(before, lv.length) - 1; p >= 0; p--) {
    const clause = clauseOf(lv, p)
    if (clause) return { clause, position: p }
  }
  return null
}
