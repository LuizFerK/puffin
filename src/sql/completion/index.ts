import type { DatabaseSchema, TableInfo } from "../../types"
import { analyze, type Suggestion } from "./context"
import { FUNCTIONS, RESERVED } from "./keywords"
import { sameIdentifier, type Scope, type ScopeEntry } from "./scope"
import { splitStatements } from "./statement"
import { isWord } from "./tokenizer"

export type ItemKind =
  | "keyword"
  | "table"
  | "view"
  | "cte"
  | "schema"
  | "column"
  | "alias"
  | "function"

export interface CompletionItem {
  label: string
  kind: ItemKind
  insertText: string
  /** Text matched against what the user typed, when it differs from the label. */
  filterText?: string
  /** Shown next to the label, e.g. the column type. */
  detail?: string
  /** Shown right-aligned, e.g. the table a column comes from. */
  description?: string
  sortText: string
  isSnippet?: boolean
}

export interface CompletionResult {
  items: CompletionItem[]
  replaceStart: number
  replaceEnd: number
  autoTrigger: boolean
}

// Lower sorts first; Monaco only falls back to sortText between equally good matches.
const RANK = {
  column: 0,
  cte: 1,
  table: 2,
  outerColumn: 3,
  alias: 4,
  schema: 5,
  otherSchemaTable: 6,
  function: 7,
  keyword: 8,
}

const sortText = (rank: number, label: string) =>
  `${rank}_${label.toLowerCase()}`

const SIMPLE_IDENTIFIER = /^[a-z_][a-z0-9_$]*$/

/** Double-quotes identifiers Postgres would otherwise fold to lowercase or reject. */
export function quoteIdentifier(name: string): string {
  if (SIMPLE_IDENTIFIER.test(name) && !RESERVED.has(name.toUpperCase()))
    return name
  return `"${name.replace(/"/g, '""')}"`
}

/** Keywords follow the case the user is typing in; uppercase by default. */
const keywordCase = (word: string) =>
  word && word === word.toLowerCase()
    ? (k: string) => k.toLowerCase()
    : (k: string) => k

const qualifierOf = (entry: ScopeEntry) => entry.ref.alias ?? entry.ref.name

function columnItems(entries: ScopeEntry[]): CompletionItem[] {
  const counts = new Map<string, number>()
  for (const e of entries.filter((e) => e.depth === 0)) {
    for (const c of new Set(e.columns.map((c) => c.name)))
      counts.set(c, (counts.get(c) ?? 0) + 1)
  }

  return entries.flatMap((entry) =>
    entry.columns.map((column) => {
      const qualifier = qualifierOf(entry)
      const ambiguous =
        entry.depth === 0 &&
        (counts.get(column.name) ?? 0) > 1 &&
        qualifier !== ""
      const name = quoteIdentifier(column.name)
      return {
        label: column.name,
        kind: "column" as const,
        insertText: ambiguous ? `${quoteIdentifier(qualifier)}.${name}` : name,
        filterText: ambiguous ? column.name : undefined,
        detail: column.data_type || undefined,
        description: qualifier || undefined,
        sortText: sortText(
          entry.depth === 0 ? RANK.column : RANK.outerColumn,
          column.name,
        ),
      }
    }),
  )
}

function aliasItems(entries: ScopeEntry[]): CompletionItem[] {
  return entries.flatMap((e) => {
    const qualifier = qualifierOf(e)
    if (!qualifier) return []
    return {
      label: qualifier,
      kind: "alias" as const,
      insertText: quoteIdentifier(qualifier),
      detail: e.ref.alias && e.ref.name ? e.ref.name : undefined,
      sortText: sortText(RANK.alias, qualifier),
    }
  })
}

function tableItem(table: TableInfo, qualify: boolean): CompletionItem {
  const label = qualify ? `${table.schema}.${table.name}` : table.name
  return {
    label,
    kind: table.kind === "table" ? "table" : "view",
    insertText: qualify
      ? `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`
      : quoteIdentifier(table.name),
    detail: table.kind.replace("_", " "),
    description: table.schema,
    sortText: sortText(qualify ? RANK.otherSchemaTable : RANK.table, label),
  }
}

const schemaItemsCache = new WeakMap<DatabaseSchema, CompletionItem[]>()

/** Tables and schemas only depend on the schema snapshot, so they're built once. */
function databaseItems(db: DatabaseSchema): CompletionItem[] {
  const cached = schemaItemsCache.get(db)
  if (cached) return cached

  const inPath = (schema: string) => db.search_path.includes(schema)
  const tables = db.tables.map((t) => tableItem(t, !inPath(t.schema)))
  const schemas = [...new Set(db.tables.map((t) => t.schema))]
    .filter((s) => !inPath(s))
    .map((schema) => ({
      label: schema,
      kind: "schema" as const,
      insertText: quoteIdentifier(schema),
      detail: "schema",
      sortText: sortText(RANK.schema, schema),
    }))

  const items = [...tables, ...schemas]
  schemaItemsCache.set(db, items)
  return items
}

function tableItems(db: DatabaseSchema | null, scope: Scope): CompletionItem[] {
  const ctes = scope.ctes.map((cte) => ({
    label: cte.name,
    kind: "cte" as const,
    insertText: quoteIdentifier(cte.name),
    detail: "CTE",
    sortText: sortText(RANK.cte, cte.name),
  }))
  return db ? [...ctes, ...databaseItems(db)] : ctes
}

function schemaTableItems(
  db: DatabaseSchema | null,
  schema: string,
): CompletionItem[] {
  if (!db) return []
  return db.tables
    .filter((t) => sameIdentifier(t.schema, schema, false))
    .map((t) => tableItem(t, false))
}

const FUNCTION_ITEMS: CompletionItem[] = FUNCTIONS.map((name) => ({
  label: name,
  kind: "function",
  insertText: `${name}($0)`,
  isSnippet: true,
  detail: "function",
  sortText: sortText(RANK.function, name),
}))

function keywordItems(
  keywords: readonly string[],
  word: string,
): CompletionItem[] {
  const toCase = keywordCase(word)
  return keywords.map((k) => ({
    label: toCase(k),
    kind: "keyword",
    insertText: toCase(k),
    sortText: sortText(RANK.keyword, k),
  }))
}

function itemsFor(
  suggestion: Suggestion,
  db: DatabaseSchema | null,
  scope: Scope,
  word: string,
): CompletionItem[] {
  switch (suggestion.type) {
    case "keyword":
      return keywordItems(suggestion.keywords, word)
    case "table":
      return tableItems(db, scope)
    case "schemaTable":
      return schemaTableItems(db, suggestion.schema)
    case "column":
      return columnItems(suggestion.entries)
    case "alias":
      return aliasItems(suggestion.entries)
    case "function":
      return FUNCTION_ITEMS
  }
}

function dedupe(items: CompletionItem[]): CompletionItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.kind}|${item.label}|${item.description ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Completion items for the cursor at `offset` in the editor content `sql`.
 * Items aren't filtered by the word being typed; the editor does fuzzy matching.
 */
export function getCompletions(
  sql: string,
  offset: number,
  db: DatabaseSchema | null,
): CompletionResult {
  const context = analyze(sql, offset, db)
  const items = context.suggestions.flatMap((s) =>
    itemsFor(s, db, context.scope, context.word),
  )
  return {
    items: dedupe(items),
    replaceStart: context.replaceStart,
    replaceEnd: context.replaceEnd,
    autoTrigger: context.autoTrigger,
  }
}

const SCHEMA_CHANGING = ["CREATE", "ALTER", "DROP", "GRANT", "REVOKE"]

/** Whether running `sql` can change which tables and columns completion should offer. */
export const changesSchema = (sql: string) =>
  splitStatements(sql).some((s) => isWord(s.tokens[0], ...SCHEMA_CHANGING))
