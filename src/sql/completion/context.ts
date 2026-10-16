import type { DatabaseSchema } from "../../types"
import { clauseAt, type Clause } from "./clauses"
import {
  EXPRESSION_KEYWORDS,
  JOIN_KEYWORDS,
  PREDICATE_KEYWORDS,
  STATEMENT_KEYWORDS,
  SUBQUERY_KEYWORDS,
  VALUE_KEYWORDS,
} from "./keywords"
import {
  entriesNamed,
  findTable,
  sameIdentifier,
  scopeAt,
  tableRef,
  type Scope,
  type ScopeEntry,
} from "./scope"
import {
  buildStructure,
  groupAt,
  levelTokens,
  statementAt,
  type Group,
  type Structure,
} from "./statement"
import { isIdentifier, isWord, tokenize, type Token } from "./tokenizer"

export type Suggestion =
  | { type: "keyword"; keywords: readonly string[] }
  | { type: "table" }
  | { type: "schemaTable"; schema: string }
  | { type: "column"; entries: ScopeEntry[] }
  | { type: "alias"; entries: ScopeEntry[] }
  | { type: "function" }

export interface CompletionContext {
  suggestions: Suggestion[]
  scope: Scope
  /** The partial identifier being typed (without a leading quote). */
  word: string
  /** Source range the accepted item replaces: the whole word around the cursor. */
  replaceStart: number
  replaceEnd: number
  /**
   * Whether the suggestions are worth popping up on their own after a space,
   * comma or paren. Keyword-only and post-operator lists are noise there.
   */
  autoTrigger: boolean
}

/** Where the cursor sits relative to the clause it belongs to. */
type Slot = "expecting" | "afterOperator" | "afterItem" | "naming"

const EMPTY_SCOPE: Scope = { entries: [], ctes: [] }

const TABLE_CLAUSES: Clause[] = [
  "from",
  "join",
  "update",
  "into",
  "using",
  "tableName",
]
const EXPRESSION_CLAUSES: Clause[] = [
  "select",
  "where",
  "on",
  "having",
  "groupBy",
  "orderBy",
  "partitionBy",
  "returning",
]

/** Words after which an expression (or operand) is expected. */
const EXPRESSION_CONNECTORS = new Set([
  "AND",
  "OR",
  "NOT",
  "WHEN",
  "THEN",
  "ELSE",
  "CASE",
  "BETWEEN",
  "IN",
  "LIKE",
  "ILIKE",
  "SIMILAR",
  "TO",
  "DISTINCT",
  "ALL",
  "ANY",
  "SOME",
  "ESCAPE",
  "ONLY",
  "LATERAL",
  "RECURSIVE",
])

/** Keywords that only make sense completed by a specific next word. */
const FOLLOW_UPS: Record<string, readonly string[]> = {
  LEFT: ["JOIN", "OUTER JOIN"],
  RIGHT: ["JOIN", "OUTER JOIN"],
  FULL: ["JOIN", "OUTER JOIN"],
  INNER: ["JOIN"],
  CROSS: ["JOIN"],
  NATURAL: ["JOIN"],
  OUTER: ["JOIN"],
  GROUP: ["BY"],
  ORDER: ["BY"],
  PARTITION: ["BY"],
  NULLS: ["FIRST", "LAST"],
  IS: ["NULL", "NOT NULL", "TRUE", "FALSE", "DISTINCT FROM"],
  INSERT: ["INTO"],
  DELETE: ["FROM"],
  UNION: ["SELECT", "ALL"],
  INTERSECT: ["SELECT"],
  EXCEPT: ["SELECT"],
  CONFLICT: ["DO NOTHING", "DO UPDATE SET"],
  DO: ["NOTHING", "UPDATE SET"],
  EXPLAIN: ["ANALYZE", ...STATEMENT_KEYWORDS],
}

const AFTER_TABLE = [
  ...JOIN_KEYWORDS,
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "LIMIT",
  "UNION",
]

const AFTER_ITEM: Partial<Record<Clause, readonly string[]>> = {
  select: ["FROM", "AS"],
  from: AFTER_TABLE,
  using: AFTER_TABLE,
  join: ["ON", "USING", ...AFTER_TABLE],
  on: [...PREDICATE_KEYWORDS, ...AFTER_TABLE],
  where: [...PREDICATE_KEYWORDS, "GROUP BY", "ORDER BY", "LIMIT", "RETURNING"],
  having: [...PREDICATE_KEYWORDS, "ORDER BY", "LIMIT"],
  groupBy: ["HAVING", "ORDER BY", "LIMIT"],
  orderBy: ["ASC", "DESC", "NULLS FIRST", "NULLS LAST", "LIMIT", "OFFSET"],
  partitionBy: ["ORDER BY"],
  limit: ["OFFSET"],
  update: ["SET"],
  set: ["WHERE", "FROM", "RETURNING"],
  into: ["VALUES", "SELECT", "DEFAULT VALUES"],
  values: ["ON CONFLICT", "RETURNING"],
  returning: ["AS"],
  with: ["AS", "SELECT", "INSERT INTO", "UPDATE", "DELETE FROM"],
  doUpdate: ["SET"],
}

// ── Cursor location ────────────────────────────────────────────────────────

interface Cursor {
  structure: Structure
  group: Group
  /** Tokens of `group.level`. */
  level: Token[]
  /** Index in `level` where the cursor (or the word being typed) starts. */
  levelPos: number
  word: string
  replaceStart: number
  replaceEnd: number
}

function isInsideLiteral(tokens: Token[], offset: number): boolean {
  return tokens.some(
    (t) =>
      (t.type === "string" || t.type === "comment") &&
      t.start < offset &&
      (offset < t.end || (offset === t.end && !t.closed)),
  )
}

/** The identifier token the cursor is touching, if any. */
function wordAt(tokens: Token[], offset: number): number {
  return tokens.findIndex((t) => {
    if (!isIdentifier(t) || t.start >= offset) return false
    if (offset < t.end) return true
    return offset === t.end && (t.type === "word" || !t.closed)
  })
}

function locate(sql: string, offset: number, allTokens: Token[]): Cursor {
  const { tokens } = statementAt(sql, offset, allTokens)
  const structure = buildStructure(tokens)
  const wordIndex = wordAt(tokens, offset)
  const word = wordIndex === -1 ? null : tokens[wordIndex]

  const cutoff = word ? wordIndex : tokens.filter((t) => t.end <= offset).length
  const replaceStart = word?.start ?? offset
  const group = groupAt(structure, replaceStart)
  const levelPos = group.level.filter((i) => i < cutoff).length

  const raw = word ? sql.slice(word.start, offset) : ""
  return {
    structure,
    group,
    level: levelTokens(structure, group),
    levelPos,
    word: word?.type === "quoted" ? raw.slice(1) : raw,
    replaceStart,
    replaceEnd: word?.end ?? offset,
  }
}

// ── Slot classification ────────────────────────────────────────────────────

function isStarItem(prev: Token, beforePrev: Token | undefined): boolean {
  return (
    prev.value === "*" &&
    (!beforePrev ||
      beforePrev.type === "comma" ||
      beforePrev.type === "dot" ||
      isWord(beforePrev, "SELECT", "DISTINCT", "ALL"))
  )
}

function slotOf(
  prev: Token | undefined,
  beforePrev: Token | undefined,
  clauseKeyword: boolean,
): Slot | null {
  if (!prev || prev.type === "comma" || prev.type === "open") return "expecting"
  if (prev.type === "operator") {
    if (prev.value === "::") return null
    return isStarItem(prev, beforePrev) ? "afterItem" : "afterOperator"
  }
  if (prev.type !== "word") return "afterItem"
  if (prev.upper === "AS") return "naming"
  if (clauseKeyword || EXPRESSION_CONNECTORS.has(prev.upper)) return "expecting"
  return "afterItem"
}

// ── Suggestion builders ────────────────────────────────────────────────────

const keywords = (list: readonly string[]): Suggestion[] =>
  list.length ? [{ type: "keyword", keywords: list }] : []

function expression(
  scope: Scope,
  extraKeywords: readonly string[] = [],
): Suggestion[] {
  return [
    { type: "column", entries: scope.entries },
    { type: "alias", entries: scope.entries },
    { type: "function" },
    { type: "keyword", keywords: [...extraKeywords, ...EXPRESSION_KEYWORDS] },
  ]
}

/** In `INSERT INTO t ... SELECT`, the SELECT can't see `t`. */
const withoutInsertTarget = (scope: Scope): Scope => ({
  ...scope,
  entries: scope.entries.filter((e) => !e.ref.insertTarget),
})

/** The UPDATE / INSERT target: always the first table the root statement names. */
function targetOf(scope: Scope): ScopeEntry[] {
  const outermost = Math.max(0, ...scope.entries.map((e) => e.depth))
  return scope.entries.filter((e) => e.depth === outermost).slice(0, 1)
}

function forClause(
  clause: Clause,
  slot: Slot,
  scope: Scope,
  prev: Token | undefined,
): Suggestion[] {
  if (slot === "naming") return []
  if (slot === "afterItem") return keywords(AFTER_ITEM[clause] ?? [])

  if (TABLE_CLAUSES.includes(clause))
    return slot === "expecting" ? [{ type: "table" }] : []

  if (clause === "set") {
    const assigning =
      slot === "expecting" && (isWord(prev, "SET") || prev?.type === "comma")
    return assigning
      ? [{ type: "column", entries: targetOf(scope) }]
      : expression(scope)
  }
  if (clause === "values")
    return [{ type: "function" }, ...keywords(VALUE_KEYWORDS)]
  if (clause === "setOp") return keywords(SUBQUERY_KEYWORDS)
  if (clause === "doUpdate") return keywords(["SET"])
  if (EXPRESSION_CLAUSES.includes(clause)) {
    const visible = clause === "returning" ? scope : withoutInsertTarget(scope)
    return expression(
      visible,
      clause === "select" && isWord(prev, "SELECT") ? ["DISTINCT"] : [],
    )
  }
  return []
}

/** Inside parentheses that don't contain a clause keyword of their own. */
function forParens(cursor: Cursor, slot: Slot, scope: Scope): Suggestion[] {
  const { structure, group } = cursor
  const parent = group.parent!
  const parentLevel = levelTokens(structure, parent)
  const pos = parent.level.indexOf(group.open)
  const before = parentLevel[pos - 1]
  const outer = clauseAt(parentLevel, pos)?.clause
  const expecting = slot === "expecting"

  if (
    isWord(before, "CONFLICT") ||
    (outer === "into" && isIdentifier(before))
  ) {
    return expecting ? [{ type: "column", entries: targetOf(scope) }] : []
  }
  if (isWord(before, "USING"))
    return expecting ? [{ type: "column", entries: scope.entries }] : []
  if (isWord(before, "OVER"))
    return expecting ? expression(scope, ["PARTITION BY", "ORDER BY"]) : []
  if (outer && ["from", "join", "with", "setOp"].includes(outer)) {
    return expecting ? keywords(SUBQUERY_KEYWORDS) : []
  }
  if (outer === "values") return forClause("values", slot, scope, undefined)
  if (!outer || slot === "naming") return []
  if (slot === "afterItem") return keywords(PREDICATE_KEYWORDS)

  const subquery =
    isWord(before, "IN", "EXISTS", "ANY", "SOME", "ALL") ||
    before?.type === "operator"
  return expression(scope, subquery && expecting ? SUBQUERY_KEYWORDS : [])
}

/** A table that isn't referenced by the query yet, e.g. `users.` typed before the FROM. */
function tableEntry(
  db: DatabaseSchema | null,
  schema: string | null,
  name: string,
): ScopeEntry[] {
  const table = findTable(db, schema, name)
  if (!table) return []
  return [{ ref: tableRef({ schema, name }), columns: table.columns, depth: 0 }]
}

function forDot(
  cursor: Cursor,
  scope: Scope,
  db: DatabaseSchema | null,
): Suggestion[] {
  const { level: lv, levelPos } = cursor
  const parts: string[] = []
  for (let p = levelPos - 2; isIdentifier(lv[p]); p -= 2) {
    parts.unshift(lv[p].value)
    if (lv[p - 1]?.type !== "dot") break
  }
  if (!parts.length) return []

  const [qualifier] = parts.slice(-1)
  const schema = parts.length > 1 ? parts[parts.length - 2] : null
  const inScope = schema === null ? entriesNamed(scope.entries, qualifier) : []
  const entries = inScope.length ? inScope : tableEntry(db, schema, qualifier)

  const isSchema =
    schema === null &&
    !!db?.tables.some((t) => sameIdentifier(t.schema, qualifier, false))
  return [
    ...(entries.length ? [{ type: "column" as const, entries }] : []),
    ...(isSchema ? [{ type: "schemaTable" as const, schema: qualifier }] : []),
  ]
}

// ── Entry point ────────────────────────────────────────────────────────────

function suggestionsAt(
  cursor: Cursor,
  scope: Scope,
  db: DatabaseSchema | null,
): { suggestions: Suggestion[]; slot: Slot | null } {
  const { group, level, levelPos } = cursor
  const prev = level[levelPos - 1]
  const beforePrev = level[levelPos - 2]

  if (prev?.type === "dot")
    return { suggestions: forDot(cursor, scope, db), slot: "expecting" }
  if (prev?.type === "word" && FOLLOW_UPS[prev.upper]) {
    return { suggestions: keywords(FOLLOW_UPS[prev.upper]), slot: "afterItem" }
  }

  const match = clauseAt(level, levelPos)
  const slot = slotOf(prev, beforePrev, match?.position === levelPos - 1)
  if (!slot) return { suggestions: [], slot }

  if (match)
    return { suggestions: forClause(match.clause, slot, scope, prev), slot }
  if (group.parent) return { suggestions: forParens(cursor, slot, scope), slot }
  return { suggestions: prev ? [] : keywords(STATEMENT_KEYWORDS), slot }
}

export function analyze(
  sql: string,
  offset: number,
  db: DatabaseSchema | null,
): CompletionContext {
  const none = {
    suggestions: [],
    scope: EMPTY_SCOPE,
    word: "",
    replaceStart: offset,
    replaceEnd: offset,
    autoTrigger: false,
  }
  const tokens = tokenize(sql)
  if (isInsideLiteral(tokens, offset)) return none

  const cursor = locate(sql, offset, tokens)
  const scope = scopeAt(cursor.structure, cursor.group, db)
  const { suggestions, slot } = suggestionsAt(cursor, scope, db)
  const hasNames = suggestions.some(
    (s) => s.type !== "keyword" && s.type !== "function",
  )

  return {
    suggestions,
    scope,
    word: cursor.word,
    replaceStart: cursor.replaceStart,
    replaceEnd: cursor.replaceEnd,
    autoTrigger: slot === "expecting" && hasNames,
  }
}
