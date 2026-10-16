import type { ColumnInfo, DatabaseSchema, TableInfo } from "../../types"
import { clauseAt, clauseOf, type Clause } from "./clauses"
import { ALIAS_STOPWORDS } from "./keywords"
import {
  groupOpenedBy,
  levelTokens,
  queryGroupOf,
  type Group,
  type Structure,
} from "./statement"
import { isIdentifier, isWord, type Token } from "./tokenizer"

export interface TableRef {
  schema: string | null
  name: string
  alias: string | null
  quoted: boolean
  /** Columns the query itself defines (CTEs, derived tables, functions); null for tables. */
  columns: ColumnInfo[] | null
  /** `FROM t AS x(a, b)` renames the first columns of `t`. */
  columnAliases: string[]
  /** Group id of the subquery, for derived tables. */
  groupId?: number
  /** `INSERT INTO t`: only visible to the column list, ON CONFLICT and RETURNING. */
  insertTarget?: boolean
}

export interface ScopeEntry {
  ref: TableRef
  columns: ColumnInfo[]
  /** 0 for the query the cursor is in, 1 for its parent query, and so on. */
  depth: number
}

export interface Scope {
  entries: ScopeEntry[]
  ctes: TableRef[]
}

interface Ctx {
  structure: Structure
  db: DatabaseSchema | null
  ctes: TableRef[]
}

/** The level of a group as tokens plus their indexes in the statement. */
interface Level {
  tokens: Token[]
  indexes: number[]
}

const levelOf = (structure: Structure, group: Group): Level => ({
  tokens: levelTokens(structure, group),
  indexes: group.level,
})

export const tableRef = (fields: Partial<TableRef> = {}): TableRef => ({
  schema: null,
  name: "",
  alias: null,
  quoted: false,
  columns: null,
  columnAliases: [],
  ...fields,
})

const isAliasToken = (t: Token | undefined) =>
  isIdentifier(t) && !(t!.type === "word" && ALIAS_STOPWORDS.has(t!.upper))

const column = (name: string, data_type = ""): ColumnInfo => ({
  name,
  data_type,
})

export const sameIdentifier = (a: string, b: string, quoted: boolean) =>
  quoted ? a === b : a.toLowerCase() === b.toLowerCase()

// ── Database lookups ───────────────────────────────────────────────────────

const tablesByName = new WeakMap<DatabaseSchema, Map<string, TableInfo[]>>()

/** Tables grouped by lowercased name, built once per schema snapshot. */
function tableIndex(db: DatabaseSchema): Map<string, TableInfo[]> {
  const cached = tablesByName.get(db)
  if (cached) return cached

  const index = new Map<string, TableInfo[]>()
  for (const t of db.tables) {
    const key = t.name.toLowerCase()
    index.set(key, [...(index.get(key) ?? []), t])
  }
  tablesByName.set(db, index)
  return index
}

export function findTable(
  db: DatabaseSchema | null,
  schema: string | null,
  name: string,
  quoted = false,
): TableInfo | null {
  if (!db) return null
  const matches = (tableIndex(db).get(name.toLowerCase()) ?? []).filter((t) =>
    sameIdentifier(t.name, name, quoted),
  )
  if (schema)
    return matches.find((t) => sameIdentifier(t.schema, schema, false)) ?? null

  const rank = (t: TableInfo) => {
    const idx = db.search_path.indexOf(t.schema)
    return idx === -1 ? Infinity : idx
  }
  return [...matches].sort((a, b) => rank(a) - rank(b))[0] ?? null
}

function findCte(ctes: TableRef[], ref: TableRef): TableRef | undefined {
  if (ref.schema) return undefined
  return ctes.find((c) => sameIdentifier(c.name, ref.name, ref.quoted))
}

function resolve(ref: TableRef, ctx: Ctx, depth: number): ScopeEntry {
  const base =
    ref.columns ??
    findCte(ctx.ctes, ref)?.columns ??
    findTable(ctx.db, ref.schema, ref.name, ref.quoted)?.columns ??
    []
  const columns = base.map((c, i) =>
    ref.columnAliases[i] ? column(ref.columnAliases[i], c.data_type) : c,
  )
  return { ref, columns, depth }
}

// ── Select list ────────────────────────────────────────────────────────────

function splitOnCommas(tokens: Token[]): Token[][] {
  return tokens.reduce<Token[][]>(
    (items, t) => {
      if (t.type === "comma") items.push([])
      else items[items.length - 1].push(t)
      return items
    },
    [[]],
  )
}

/** Level tokens of the select list, without SELECT / DISTINCT [ON (...)] / ALL. */
function selectListTokens(lv: Token[]): Token[] {
  const select = lv.findIndex((t) => isWord(t, "SELECT"))
  if (select === -1) return []

  let start = select + 1
  if (isWord(lv[start], "ALL")) start++
  if (isWord(lv[start], "DISTINCT")) start++
  if (isWord(lv[start - 1], "DISTINCT") && isWord(lv[start], "ON")) start += 3

  // GROUP/ORDER only become clauses at BY, so stop at them explicitly
  const end = lv.findIndex(
    (t, i) =>
      i >= start &&
      (clauseOf(lv, i) !== null ||
        isWord(t, "GROUP", "ORDER", "WINDOW", "FOR")),
  )
  return lv.slice(start, end === -1 ? undefined : end)
}

function itemColumns(item: Token[], scope: ScopeEntry[]): ColumnInfo[] {
  const n = item.length
  const [last, prev, beforePrev] = [item[n - 1], item[n - 2], item[n - 3]]
  if (!last) return []

  const typeOf = (name: string, qualifier: string | null) =>
    entriesNamed(scope, qualifier)
      .flatMap((e) => e.columns)
      .find((c) => sameIdentifier(c.name, name, false))?.data_type ?? ""

  if (n === 1 && last.value === "*")
    return entriesNamed(scope, null).flatMap((e) => e.columns)
  if (last.value === "*" && prev?.type === "dot" && isIdentifier(beforePrev)) {
    return entriesNamed(scope, beforePrev.value).flatMap((e) => e.columns)
  }
  if (isWord(prev, "AS") && isIdentifier(last)) return [column(last.value)]
  if (n === 1 && isIdentifier(last))
    return [column(last.value, typeOf(last.value, null))]
  if (
    n === 3 &&
    prev?.type === "dot" &&
    isIdentifier(beforePrev) &&
    isIdentifier(last)
  ) {
    return [column(last.value, typeOf(last.value, beforePrev.value))]
  }
  if (isAliasToken(last) && prev && !["operator", "dot"].includes(prev.type))
    return [column(last.value)]
  if (isIdentifier(item[0]) && item[1]?.type === "open")
    return [column(item[0].value.toLowerCase())]
  return []
}

/** Output columns of a subquery, used for CTEs and derived tables. */
function selectColumns(group: Group, ctx: Ctx): ColumnInfo[] {
  const lv = levelTokens(ctx.structure, group)
  const scope = groupRefs(group, ctx).map((r) => resolve(r, ctx, 0))
  return splitOnCommas(selectListTokens(lv)).flatMap((item) =>
    itemColumns(item, scope),
  )
}

// ── Table references ───────────────────────────────────────────────────────

interface Parsed<T> {
  value: T
  next: number
}

function closeAfter(level: Level, openPos: number): number {
  return level.tokens[openPos + 1]?.type === "close"
    ? openPos + 2
    : level.tokens.length
}

function parseNameList(ctx: Ctx, openIndex: number): string[] {
  const group = groupOpenedBy(ctx.structure, openIndex)
  if (!group) return []
  return levelTokens(ctx.structure, group)
    .filter(isIdentifier)
    .map((t) => t.value)
}

function parseAlias(level: Level, pos: number): Parsed<Token | null> {
  const lv = level.tokens
  if (isWord(lv[pos], "AS") && isIdentifier(lv[pos + 1]))
    return { value: lv[pos + 1], next: pos + 2 }
  if (isAliasToken(lv[pos])) return { value: lv[pos], next: pos + 1 }
  return { value: null, next: pos }
}

function parseSource(
  level: Level,
  pos: number,
  ctx: Ctx,
  allowFunction: boolean,
): Parsed<TableRef> | null {
  const lv = level.tokens
  const first = lv[pos]

  if (first?.type === "open") {
    const group = groupOpenedBy(ctx.structure, level.indexes[pos])
    const columns = group?.isQuery ? selectColumns(group, ctx) : []
    const value = tableRef({ columns, groupId: group?.id })
    return { value, next: closeAfter(level, pos) }
  }

  if (!isAliasToken(first)) return null

  const parts = [first]
  let p = pos + 1
  while (lv[p]?.type === "dot" && isIdentifier(lv[p + 1])) {
    parts.push(lv[p + 1])
    p += 2
  }

  const name = parts[parts.length - 1]
  const schema = parts.length > 1 ? parts[parts.length - 2].value : null
  const isFunction = allowFunction && lv[p]?.type === "open"
  if (isFunction) p = closeAfter(level, p)
  if (lv[p]?.value === "*") p++

  const value = tableRef({
    schema,
    name: name.value,
    quoted: name.type === "quoted",
    columns: isFunction ? [] : null,
  })
  return { value, next: p }
}

function parseRef(
  level: Level,
  pos: number,
  ctx: Ctx,
  allowFunction: boolean,
): Parsed<TableRef> | null {
  let p = pos
  while (isWord(level.tokens[p], "ONLY", "LATERAL")) p++

  const source = parseSource(level, p, ctx, allowFunction)
  if (!source) return null

  const alias = parseAlias(level, source.next)
  const hasColumnAliases =
    alias.value && level.tokens[alias.next]?.type === "open"
  const columnAliases = hasColumnAliases
    ? parseNameList(ctx, level.indexes[alias.next])
    : []
  const next = hasColumnAliases ? closeAfter(level, alias.next) : alias.next

  const aliasName = alias.value?.value ?? null
  const isDerived = source.value.groupId !== undefined
  const ref: TableRef = {
    ...source.value,
    name: isDerived ? (aliasName ?? "") : source.value.name,
    alias: aliasName,
    columnAliases,
  }
  return { value: ref, next }
}

/** Parses `item [, item ...]`, or a single item when `list` is false. */
function parseCommaList<T>(
  level: Level,
  pos: number,
  list: boolean,
  parseOne: (pos: number, parsed: T[]) => Parsed<T> | null,
): Parsed<T[]> {
  const items: T[] = []
  let p = pos

  for (;;) {
    const parsed = parseOne(p, items)
    if (!parsed) break
    items.push(parsed.value)
    p = parsed.next
    if (!list || level.tokens[p]?.type !== "comma") break
    p++
  }

  return { value: items, next: p }
}

const TABLE_LIST_CLAUSES: Clause[] = ["from", "using"]
const SINGLE_TABLE_CLAUSES: Clause[] = ["join", "update", "into"]

/** The clause at `p` if it's followed by table references. */
function tableClause(lv: Token[], p: number): Clause | null {
  const clause = clauseOf(lv, p)
  // `JOIN ... USING (cols)` lists columns
  if (clause === "using" && lv[p + 1]?.type === "open") return null
  if (!clause) return null
  return [...TABLE_LIST_CLAUSES, ...SINGLE_TABLE_CLAUSES].includes(clause)
    ? clause
    : null
}

/** Tables referenced directly by a query group (not by its subqueries). */
function groupRefs(group: Group, ctx: Ctx): TableRef[] {
  const level = levelOf(ctx.structure, group)
  const refs: TableRef[] = []

  for (let p = 0; p < level.tokens.length; ) {
    const clause = tableClause(level.tokens, p)
    if (!clause) {
      p++
      continue
    }
    const into = clause === "into"
    // `INSERT INTO t (` opens a column list, not a set-returning function call
    const parsed = parseCommaList(
      level,
      p + 1,
      TABLE_LIST_CLAUSES.includes(clause),
      (pos) => parseRef(level, pos, ctx, !into),
    )
    refs.push(
      ...parsed.value.map((r) => (into ? { ...r, insertTarget: true } : r)),
    )
    p = Math.max(parsed.next, p + 1)
  }

  return refs
}

// ── CTEs ───────────────────────────────────────────────────────────────────

function parseCte(
  level: Level,
  pos: number,
  ctx: Ctx,
): Parsed<TableRef> | null {
  const lv = level.tokens
  const name = lv[pos]
  if (!isIdentifier(name)) return null

  let p = pos + 1
  let columnAliases: string[] = []
  if (lv[p]?.type === "open") {
    columnAliases = parseNameList(ctx, level.indexes[p])
    p = closeAfter(level, p)
  }
  if (!isWord(lv[p], "AS")) return null
  p++
  while (isWord(lv[p], "NOT", "MATERIALIZED")) p++
  if (lv[p]?.type !== "open") return null

  const body = groupOpenedBy(ctx.structure, level.indexes[p])
  const bodyColumns = body?.isQuery ? selectColumns(body, ctx) : []
  const columns = columnAliases.length
    ? columnAliases.map((alias, i) => column(alias, bodyColumns[i]?.data_type))
    : bodyColumns
  const ref = tableRef({
    name: name.value,
    quoted: name.type === "quoted",
    columns,
  })
  return { value: ref, next: closeAfter(level, p) }
}

/** CTEs declared by a `WITH` at the start of the group; each one sees the previous ones. */
function groupCtes(group: Group, ctx: Ctx): TableRef[] {
  const level = levelOf(ctx.structure, group)
  if (!isWord(level.tokens[0], "WITH")) return []

  const start = isWord(level.tokens[1], "RECURSIVE") ? 2 : 1
  return parseCommaList<TableRef>(level, start, true, (pos, previous) =>
    parseCte(level, pos, { ...ctx, ctes: [...ctx.ctes, ...previous] }),
  ).value
}

// ── Scope ──────────────────────────────────────────────────────────────────

/** Entries matching a qualifier: alias first, then bare table name. `null` returns all. */
export function entriesNamed(
  entries: ScopeEntry[],
  qualifier: string | null,
): ScopeEntry[] {
  if (qualifier === null) return entries
  const byAlias = entries.filter(
    (e) => e.ref.alias && sameIdentifier(e.ref.alias, qualifier, false),
  )
  if (byAlias.length) return byAlias
  return entries.filter(
    (e) =>
      !e.ref.alias &&
      e.ref.name &&
      sameIdentifier(e.ref.name, qualifier, false),
  )
}

/**
 * Derived tables and CTE bodies can't see the enclosing query's tables
 * (LATERAL aside); scalar, IN and EXISTS subqueries can.
 */
function isCorrelated(group: Group, structure: Structure): boolean {
  if (!group.parent) return false
  const parentLevel = levelTokens(structure, group.parent)
  const pos = group.parent.level.indexOf(group.open)
  const before = parentLevel[pos - 1]
  if (isWord(before, "LATERAL")) return true
  if (isWord(before, "AS", "MATERIALIZED")) return false

  const clause = clauseAt(parentLevel, pos)?.clause
  return !["from", "join", "using", "with"].includes(clause ?? "")
}

function ancestorQueries(group: Group): Group[] {
  const query = queryGroupOf(group)
  return query.parent ? [query, ...ancestorQueries(query.parent)] : [query]
}

/** Tables visible from a group, innermost query first. */
export function scopeAt(
  structure: Structure,
  group: Group,
  db: DatabaseSchema | null,
): Scope {
  const queries = ancestorQueries(group)
  const ctes = [...queries]
    .reverse()
    .reduce<
      TableRef[]
    >((acc, q) => [...acc, ...groupCtes(q, { structure, db, ctes: acc })], [])
  const ctx: Ctx = { structure, db, ctes }

  const entries: ScopeEntry[] = []
  for (const [depth, query] of queries.entries()) {
    // A LATERAL subquery sees the tables next to it, but not itself
    const inner = queries[depth - 1]
    const refs = groupRefs(query, ctx).filter(
      (r) => inner === undefined || r.groupId !== inner.id,
    )
    entries.push(...refs.map((r) => resolve(r, ctx, depth)))
    if (!isCorrelated(query, structure)) break
  }

  return { entries, ctes }
}
