import { isWord, tokenize, type Token } from "./tokenizer"

export interface Statement {
  start: number
  end: number
  /** Statement tokens without comments. */
  tokens: Token[]
}

/**
 * A parenthesized region of a statement (or the statement itself, the root).
 * `level` holds the indexes of the tokens that sit directly inside it, so walking
 * a level skips over nested parentheses as a single unit.
 */
export interface Group {
  id: number
  /** Index of the opening paren token, -1 for the root. */
  open: number
  /** Index of the closing paren token, null while unclosed. */
  close: number | null
  parent: Group | null
  level: number[]
  /** Starts with SELECT / WITH / VALUES / TABLE: introduces its own table scope. */
  isQuery: boolean
}

export interface Structure {
  tokens: Token[]
  groups: Group[]
}

const BLANK_LINE = /\n[ \t\r]*(?=\n)/g

/**
 * Offset where a blank line splits the gap between two tokens, or null.
 * The line the cursor is on never counts as blank: it's where the user is typing.
 */
function blankLineBoundary(
  sql: string,
  from: number,
  to: number,
  cursor: number,
): number | null {
  const gap = sql.slice(from, to)
  for (const match of gap.matchAll(BLANK_LINE)) {
    const lineStart = from + match.index + 1
    const lineEnd = lineStart + match[0].length - 1
    if (cursor < lineStart || cursor > lineEnd) return from + match.index
  }
  return null
}

/**
 * Splits the editor content into statements, using the same separators as the
 * query runner (`;` and blank lines) but ignoring those inside strings or comments.
 * Boundaries are inclusive on both sides: a cursor right before `;` belongs to the
 * statement it ends, a cursor right after it to the next one.
 */
export function splitStatements(
  sql: string,
  cursor = -1,
  tokens = tokenize(sql),
): Statement[] {
  const statements: Statement[] = []
  let current: Statement = { start: 0, end: sql.length, tokens: [] }
  let prevEnd = 0

  const cut = (end: number, nextStart: number) => {
    statements.push({ ...current, end })
    current = { start: nextStart, end: sql.length, tokens: [] }
  }

  for (const token of tokens) {
    const blank = blankLineBoundary(sql, prevEnd, token.start, cursor)
    if (blank !== null) cut(blank, blank + 1)

    if (token.type === "semicolon") cut(token.start, token.end)
    else if (token.type !== "comment") current.tokens.push(token)
    prevEnd = token.end
  }

  const trailingBlank = blankLineBoundary(sql, prevEnd, sql.length, cursor)
  if (trailingBlank !== null) cut(trailingBlank, trailingBlank + 1)
  statements.push(current)

  return statements
}

export function statementAt(
  sql: string,
  offset: number,
  tokens = tokenize(sql),
): Statement {
  const statements = splitStatements(sql, offset, tokens)
  return (
    statements.find((s) => offset >= s.start && offset <= s.end) ??
    statements[statements.length - 1]
  )
}

const QUERY_STARTERS = ["SELECT", "WITH", "VALUES", "TABLE"]

export function buildStructure(tokens: Token[]): Structure {
  const root: Group = {
    id: 0,
    open: -1,
    close: null,
    parent: null,
    level: [],
    isQuery: true,
  }
  const groups: Group[] = [root]
  let current = root

  tokens.forEach((token, i) => {
    if (token.type === "close" && current.parent) {
      current.close = i
      current = current.parent
    }

    current.level.push(i)

    if (token.type === "open") {
      const group: Group = {
        id: groups.length,
        open: i,
        close: null,
        parent: current,
        level: [],
        isQuery: isWord(tokens[i + 1], ...QUERY_STARTERS),
      }
      groups.push(group)
      current = group
    }
  })

  return { tokens, groups }
}

export const levelTokens = (structure: Structure, group: Group): Token[] =>
  group.level.map((i) => structure.tokens[i])

/** Innermost group whose parentheses enclose `offset`. */
export function groupAt(structure: Structure, offset: number): Group {
  const { tokens, groups } = structure
  const encloses = (g: Group) =>
    g.open === -1 ||
    (tokens[g.open].end <= offset &&
      (g.close === null || offset <= tokens[g.close].start))

  // Groups are created in opening order, so the innermost match comes last
  const enclosing = groups.filter(encloses)
  return enclosing[enclosing.length - 1]
}

/** Nearest enclosing group (itself included) that defines a table scope. */
export function queryGroupOf(group: Group): Group {
  return group.isQuery || !group.parent ? group : queryGroupOf(group.parent)
}

/** The group a given opening paren token starts. */
export function groupOpenedBy(
  structure: Structure,
  openIndex: number,
): Group | undefined {
  return structure.groups.find((g) => g.open === openIndex)
}
