/**
 * SQL query context analyzer — a state machine that walks tokens
 * from the start of the current query up to the cursor position
 * and determines what kind of completions to suggest.
 *
 * ── Future enhancements ──
 * - Add DDL states (CREATE TABLE, ALTER, DROP) and their transitions.
 * - Support subquery nesting with a state stack.
 * - Track column types for smarter operator / value suggestions.
 */

import { tokenize, type Token } from "./sqlTokenizer";

// ── State enum ───────────────────────────────────────────────────────────

export enum SqlState {
  /** Start of query — suggest statement keywords. */
  INITIAL = "INITIAL",
  /** After SELECT, before FROM — suggest columns, *, functions. */
  SELECT_FIELDS = "SELECT_FIELDS",
  /** After SELECT_FIELDS — suggest caluses. */
  CLAUSE = "CLAUSE",
  /** After FROM / JOIN — suggest table names. */
  FROM_CLAUSE = "FROM_CLAUSE",
  /** After WHERE / AND / OR / ON — suggest columns, operators, functions. */
  WHERE_CLAUSE = "WHERE_CLAUSE",
  /** After UPDATE <table> SET — suggest columns of target table. */
  SET_CLAUSE = "SET_CLAUSE",
  /** After INSERT INTO — suggest table names. */
  INSERT_TABLE = "INSERT_TABLE",
  /** After INSERT INTO <table> ( — suggest columns of target table. */
  INSERT_COLUMNS = "INSERT_COLUMNS",
  /** After VALUES ( — suggest functions, literals. */
  VALUES_CLAUSE = "VALUES_CLAUSE",
  /** After UPDATE — suggest table names. */
  UPDATE_TABLE = "UPDATE_TABLE",
  /** After DELETE FROM — suggest table names. */
  DELETE_TABLE = "DELETE_TABLE",
  /** After ORDER BY / GROUP BY — suggest columns. */
  ORDER_GROUP_BY = "ORDER_GROUP_BY",
  /** After HAVING — suggest columns, aggregate functions. */
  HAVING_CLAUSE = "HAVING_CLAUSE",
  /** After <identifier>. — suggest columns of that specific table. */
  DOT_ACCESS = "DOT_ACCESS",
  /** Fallback — suggest keywords + tables + columns. */
  GENERIC = "GENERIC",
}

// ── Context result ───────────────────────────────────────────────────────

export interface QueryContext {
  /** The current state that determines what to suggest. */
  state: SqlState;
  /** Map of alias/name → real table name for all referenced tables. */
  referencedTables: Map<string, string>;
  /** For UPDATE / INSERT — the primary target table name. */
  targetTable: string | null;
  /** When in DOT_ACCESS, the identifier before the dot. */
  dotPrefix: string | null;
  /** The partial word the user is currently typing (for filtering). */
  currentWord: string;
}

// ── Analyzer ─────────────────────────────────────────────────────────────

/**
 * Analyze the SQL text from the start of the current query segment
 * up to `cursorOffset` and return a `QueryContext` describing what
 * completions are appropriate.
 */
export function analyzeQueryContext(
  sql: string,
  cursorOffset: number
): QueryContext {
  const tokens = tokenize(sql, cursorOffset);
  console.log(tokens, "tokens")

  let state: SqlState = SqlState.INITIAL;
  const referencedTables = new Map<string, string>();
  let targetTable: string | null = null;
  let dotPrefix: string | null = null;
  let parenDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const kw = tok.type === "keyword" ? tok.value : null;
    const prev = tokens[i - 1] as Token | undefined;
    const next = tokens[i + 1] as Token | undefined;
    const nextNext = tokens[i + 2] as Token | undefined;

    // ── Track paren depth ────────────────────────────────────────
    if (tok.type === "paren_open") {
      parenDepth++;

      // INSERT INTO <table> ( → INSERT_COLUMNS
      if (state === SqlState.INSERT_TABLE && targetTable) {
        state = SqlState.INSERT_COLUMNS;
        continue;
      }
      continue;
    }
    if (tok.type === "paren_close") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    // ── Dot access ───────────────────────────────────────────────
    if (tok.type === "dot") {
      // Look at the previous token for the table/alias name
      const prev = tokens[i - 1];
      if (prev && prev.type === "identifier") {
        dotPrefix = prev.value;
        state = SqlState.DOT_ACCESS;
      }
      continue;
    }

    // If we were in DOT_ACCESS and consumed the identifier after the dot,
    // return to the previous logical state — but the state machine will
    // recalculate on next call, so we just reset dotPrefix.
    if (state === SqlState.DOT_ACCESS && tok.type === "identifier") {
      dotPrefix = null;
      // Don't change state — let the next keyword transition handle it
      // Stay as DOT_ACCESS only while the dot is the last meaningful token
      state = SqlState.GENERIC;
      continue;
    }

    // ── Statement-level transitions ──────────────────────────────
    if (kw === "SELECT") {
      state = SqlState.SELECT_FIELDS;
      continue;
    }

    if (kw === "UPDATE") {
      state = SqlState.UPDATE_TABLE;
      continue;
    }

    if (kw === "INSERT INTO") {
      state = SqlState.INSERT_TABLE;
      continue;
    }

    if (kw === "DELETE FROM") {
      state = SqlState.DELETE_TABLE;
      continue;
    }

    // ── Clause-level transitions ─────────────────────────────────
    if (kw === "FROM" || kw === "JOIN" || kw === "INNER JOIN" ||
      kw === "LEFT JOIN" || kw === "RIGHT JOIN" ||
      kw === "FULL JOIN" || kw === "CROSS JOIN") {
      state = SqlState.FROM_CLAUSE;
      continue;
    }

    if (kw === "WHERE" || kw === "AND" || kw === "OR" || kw === "ON") {
      state = SqlState.WHERE_CLAUSE;
      continue;
    }

    if (kw === "SET") {
      state = SqlState.SET_CLAUSE;
      continue;
    }

    if (kw === "VALUES") {
      state = SqlState.VALUES_CLAUSE;
      continue;
    }

    if (kw === "GROUP BY" || kw === "ORDER BY") {
      state = SqlState.ORDER_GROUP_BY;
      continue;
    }

    if (kw === "HAVING") {
      state = SqlState.HAVING_CLAUSE;
      continue;
    }

    if (kw === "RETURNING") {
      state = SqlState.SELECT_FIELDS;
      continue;
    }

    // ── Table reference tracking ─────────────────────────────────
    // We record table names (and optional aliases) when in states
    // that expect table identifiers.
    if (["identifier", "star", "whitespace"].includes(tok.type)) {
      const tableName = tok.value;

      switch (state) {
        case SqlState.SELECT_FIELDS: {
          state = SqlState.CLAUSE;
          break;
        }

        case SqlState.CLAUSE: {
          break;
        }

        case SqlState.FROM_CLAUSE: {
          // FROM <table> [AS] <alias>
          referencedTables.set(tableName, tableName);
          const aliasInfo = peekAlias(next, nextNext);
          if (aliasInfo) {
            referencedTables.set(aliasInfo.alias, tableName);
            i += aliasInfo.skip;
          }
          if (tok.type === "whitespace" && prev?.value !== "FROM") {
            state = SqlState.CLAUSE;
          }
          break;
        }

        case SqlState.UPDATE_TABLE: {
          targetTable = tableName;
          referencedTables.set(tableName, tableName);
          const aliasInfo = peekAlias(next, nextNext);
          if (aliasInfo) {
            referencedTables.set(aliasInfo.alias, tableName);
            i += aliasInfo.skip;
          }
          // After capturing the table, transition to GENERIC
          // (SET keyword will transition to SET_CLAUSE)
          state = SqlState.GENERIC;
          break;
        }

        case SqlState.INSERT_TABLE: {
          targetTable = tableName;
          referencedTables.set(tableName, tableName);
          // Stay in INSERT_TABLE so paren_open can transition to INSERT_COLUMNS
          break;
        }

        case SqlState.DELETE_TABLE: {
          targetTable = tableName;
          referencedTables.set(tableName, tableName);
          const aliasInfo = peekAlias(next, nextNext);
          if (aliasInfo) {
            referencedTables.set(aliasInfo.alias, tableName);
            i += aliasInfo.skip;
          }
          state = SqlState.GENERIC;
          break;
        }

        default:
          break;
      }
    }
  }

  // ── Determine current partial word ─────────────────────────────
  const currentWord = extractPartialWord(sql, cursorOffset);

  // If the very last token before cursor is a dot, we're in DOT_ACCESS
  if (tokens.length > 0) {
    const lastTok = tokens[tokens.length - 1];
    if (lastTok.type === "dot") {
      state = SqlState.DOT_ACCESS;
      const prevTok = tokens[tokens.length - 2];
      if (prevTok && prevTok.type === "identifier") {
        dotPrefix = prevTok.value;
      }
    }
  }

  return {
    state,
    referencedTables,
    targetTable,
    dotPrefix,
    currentWord,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Peek ahead to detect an alias pattern: `<table> <alias>` or `<table> AS <alias>`.
 * Returns the alias identifier and number of tokens to skip, or null.
 */
function peekAlias(
  next: Token | undefined,
  nextNext: Token | undefined
): { alias: string; skip: number } | null {
  if (!next) return null;

  // <table> AS <alias>
  if (
    next.type === "keyword" &&
    next.value === "AS" &&
    nextNext?.type === "identifier"
  ) {
    return { alias: nextNext.value, skip: 2 };
  }

  // <table> <alias> (no AS — identifier directly after table, not a keyword)
  if (next.type === "identifier") {
    return { alias: next.value, skip: 1 };
  }

  return null;
}

/**
 * Extract the partial word the user is typing at cursor position.
 * Walks backwards from cursorOffset to find contiguous word characters.
 */
function extractPartialWord(sql: string, cursorOffset: number): string {
  let start = cursorOffset;
  while (start > 0 && /[a-zA-Z0-9_]/.test(sql[start - 1])) {
    start--;
  }
  return sql.slice(start, cursorOffset);
}
