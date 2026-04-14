/**
 * Lightweight SQL tokenizer for the completion state machine.
 *
 * Splits raw SQL text into typed tokens so the state machine can
 * walk them and determine the current query context.
 */

export type TokenType =
  | "keyword"
  | "identifier"
  | "dot"
  | "comma"
  | "semicolon"
  | "paren_open"
  | "paren_close"
  | "operator"
  | "star"
  | "string"
  | "number"
  | "whitespace"
  | "unknown"

export interface Token {
  type: TokenType
  value: string
  /** Character offset in the source string where this token starts. */
  offset: number
}

/**
 * Two-word keyword pairs that must be recognised as a single keyword token.
 * Order matters: longer / more specific combos first.
 */
const COMPOUND_KEYWORDS = [
  "INSERT INTO",
  "DELETE FROM",
  "GROUP BY",
  "ORDER BY",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "IS NOT",
  "NOT IN",
  "NULLS FIRST",
  "NULLS LAST",
]

/**
 * Single-word SQL reserved words that the tokenizer should tag as `keyword`
 * rather than `identifier`. Keep upper-cased.
 */
const SINGLE_KEYWORDS = new Set([
  // Statements
  "SELECT",
  "UPDATE",
  "DELETE",
  "INSERT",
  "WITH",
  // Clauses
  "FROM",
  "WHERE",
  "SET",
  "INTO",
  "VALUES",
  "JOIN",
  "ON",
  "AND",
  "OR",
  "NOT",
  "IN",
  "EXISTS",
  "BETWEEN",
  "LIKE",
  "ILIKE",
  "IS",
  "AS",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "ALL",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "RETURNING",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "ASC",
  "DESC",
  "DEFAULT",
  "NULL",
  "TRUE",
  "FALSE",
  // Joins without compound (fallback)
  "INNER",
  "LEFT",
  "RIGHT",
  "FULL",
  "CROSS",
  "OUTER",
  // GROUP, ORDER need special handling as they can appear standalone
  "GROUP",
  "ORDER",
  "BY",
  "NULLS",
  "FIRST",
  "LAST",
])

const OPERATORS = new Set([
  "=",
  "<>",
  "!=",
  ">=",
  "<=",
  ">",
  "<",
  "||",
  "::",
  "->",
  "->>",
  "#>",
  "#>>",
])

/**
 * Tokenize SQL source text up to (but not including) `endOffset`.
 * Whitespace tokens are **skipped** by default.
 */
export function tokenize(sql: string, endOffset?: number): Token[] {
  const end = endOffset ?? sql.length
  const tokens: Token[] = []
  let i = 0

  while (i < end) {
    const ch = sql[i]

    // ── Whitespace ────────────────────────────────────────────────────
    if (/\s/.test(ch)) {
      let j = i + 1
      while (j < end && /\s/.test(sql[j])) j++
      // skip whitespace tokens — we don't include them
      i = j
      tokens.push({ type: "whitespace", value: ch, offset: i })
      continue
    }

    // ── Single-line comment (-- ...) ─────────────────────────────────
    if (ch === "-" && i + 1 < end && sql[i + 1] === "-") {
      let j = i + 2
      while (j < end && sql[j] !== "\n") j++
      i = j
      continue
    }

    // ── Block comment (/* ... */) ────────────────────────────────────
    if (ch === "/" && i + 1 < end && sql[i + 1] === "*") {
      let j = i + 2
      while (j < end - 1 && !(sql[j] === "*" && sql[j + 1] === "/")) j++
      i = j + 2
      continue
    }

    // ── String literal ('...') ───────────────────────────────────────
    if (ch === "'") {
      let j = i + 1
      while (j < end) {
        if (sql[j] === "'" && j + 1 < end && sql[j + 1] === "'") {
          j += 2 // escaped quote
        } else if (sql[j] === "'") {
          j++
          break
        } else {
          j++
        }
      }
      tokens.push({ type: "string", value: sql.slice(i, j), offset: i })
      i = j
      continue
    }

    // ── Quoted identifier ("...") ────────────────────────────────────
    if (ch === '"') {
      let j = i + 1
      while (j < end && sql[j] !== '"') j++
      j++ // closing quote
      const raw = sql.slice(i + 1, j - 1)
      tokens.push({ type: "identifier", value: raw, offset: i })
      i = j
      continue
    }

    // ── Number ───────────────────────────────────────────────────────
    if (/\d/.test(ch)) {
      let j = i + 1
      while (j < end && /[\d.]/.test(sql[j])) j++
      tokens.push({ type: "number", value: sql.slice(i, j), offset: i })
      i = j
      continue
    }

    // ── Simple single-character tokens ───────────────────────────────
    if (ch === ".") {
      tokens.push({ type: "dot", value: ".", offset: i })
      i++
      continue
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: ",", offset: i })
      i++
      continue
    }
    if (ch === ";") {
      tokens.push({ type: "semicolon", value: ";", offset: i })
      i++
      continue
    }
    if (ch === "(") {
      tokens.push({ type: "paren_open", value: "(", offset: i })
      i++
      continue
    }
    if (ch === ")") {
      tokens.push({ type: "paren_close", value: ")", offset: i })
      i++
      continue
    }
    if (ch === "*") {
      tokens.push({ type: "star", value: "*", offset: i })
      i++
      continue
    }

    // ── Multi-character operators ────────────────────────────────────
    if (/[=<>!|:\-#]/.test(ch)) {
      // Try 3-char, then 2-char, then 1-char
      const three = sql.slice(i, i + 3)
      if (OPERATORS.has(three)) {
        tokens.push({ type: "operator", value: three, offset: i })
        i += 3
        continue
      }
      const two = sql.slice(i, i + 2)
      if (OPERATORS.has(two)) {
        tokens.push({ type: "operator", value: two, offset: i })
        i += 2
        continue
      }
      if (OPERATORS.has(ch)) {
        tokens.push({ type: "operator", value: ch, offset: i })
        i++
        continue
      }
      // Lone char that looks like operator but doesn't match
      tokens.push({ type: "unknown", value: ch, offset: i })
      i++
      continue
    }

    // ── Word (keyword or identifier) ─────────────────────────────────
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i + 1
      while (j < end && /[a-zA-Z0-9_]/.test(sql[j])) j++
      const word = sql.slice(i, j)
      const upper = word.toUpperCase()

      // Try compound keywords (look ahead past whitespace for the next word)
      let matched = false
      for (const compound of COMPOUND_KEYWORDS) {
        const parts = compound.split(" ")
        if (parts[0] !== upper) continue

        // Look ahead to see if the remaining parts follow
        let cursor = j
        let allMatch = true
        for (let p = 1; p < parts.length; p++) {
          // skip whitespace
          while (cursor < end && /\s/.test(sql[cursor])) cursor++
          const nextWord = extractWord(sql, cursor, end)
          if (nextWord.toUpperCase() !== parts[p]) {
            allMatch = false
            break
          }
          cursor += nextWord.length
        }

        if (allMatch) {
          tokens.push({ type: "keyword", value: compound, offset: i })
          i = cursor
          matched = true
          break
        }
      }
      if (matched) continue

      // Single keyword or identifier
      if (SINGLE_KEYWORDS.has(upper)) {
        tokens.push({ type: "keyword", value: upper, offset: i })
      } else {
        tokens.push({ type: "identifier", value: word, offset: i })
      }
      i = j
      continue
    }

    // ── Unknown ──────────────────────────────────────────────────────
    tokens.push({ type: "unknown", value: ch, offset: i })
    i++
  }

  return tokens
}

/** Extract a word (letters, digits, underscores) starting at `pos`. */
function extractWord(sql: string, pos: number, end: number): string {
  let j = pos
  while (j < end && /[a-zA-Z0-9_]/.test(sql[j])) j++
  return sql.slice(pos, j)
}
