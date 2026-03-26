/**
 * SQL keyword lists, PostgreSQL function names, and operator constants
 * used by the completion state machine.
 *
 * ── Future enhancements ──
 * - Extend the Rust `fetch_schema` backend to return column types and
 *   PostgreSQL function names from `pg_proc`, replacing the hardcoded
 *   function list below with live introspection data.
 * - Add DDL statement keywords (CREATE, ALTER, DROP, TRUNCATE, etc.)
 *   and corresponding state machine states for DDL completion support.
 */

/** Top-level SQL statement keywords suggested at the start of a query. */
export const STATEMENT_KEYWORDS = [
  "SELECT",
  "UPDATE",
  "INSERT",
  "DELETE",
  "WITH",
  // TODO: DDL statements — CREATE, ALTER, DROP, TRUNCATE — not yet supported
  // by the state machine. Add states and transitions when implementing DDL.
] as const;

/** Clause keywords that drive state transitions inside a query. */
export const CLAUSE_KEYWORDS = [
  "FROM",
  "WHERE",
  "SET",
  "INTO",
  "VALUES",
  "JOIN",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "CROSS JOIN",
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
  "IS NOT",
  "AS",
  "GROUP BY",
  "ORDER BY",
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
  "NULLS FIRST",
  "NULLS LAST",
  "DEFAULT",
  "NULL",
  "TRUE",
  "FALSE",
] as const;

/**
 * Common PostgreSQL functions grouped by category.
 *
 * TODO: In the future, fetch function names from the backend via
 * `pg_proc` introspection for full coverage of user-defined and
 * extension functions.
 */
export const PG_FUNCTIONS = {
  aggregate: [
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "ARRAY_AGG",
    "STRING_AGG",
    "BOOL_AND",
    "BOOL_OR",
    "JSON_AGG",
    "JSONB_AGG",
    "JSON_OBJECT_AGG",
    "JSONB_OBJECT_AGG",
  ],
  string: [
    "CONCAT",
    "LENGTH",
    "LOWER",
    "UPPER",
    "TRIM",
    "LTRIM",
    "RTRIM",
    "SUBSTRING",
    "REPLACE",
    "SPLIT_PART",
    "LEFT",
    "RIGHT",
    "REPEAT",
    "REVERSE",
    "POSITION",
    "INITCAP",
    "FORMAT",
    "REGEXP_REPLACE",
    "REGEXP_MATCH",
  ],
  date: [
    "NOW",
    "CURRENT_DATE",
    "CURRENT_TIME",
    "CURRENT_TIMESTAMP",
    "DATE_TRUNC",
    "DATE_PART",
    "EXTRACT",
    "AGE",
    "MAKE_DATE",
    "MAKE_INTERVAL",
    "TO_CHAR",
    "TO_DATE",
    "TO_TIMESTAMP",
  ],
  math: [
    "ABS",
    "CEIL",
    "FLOOR",
    "ROUND",
    "MOD",
    "POWER",
    "SQRT",
    "RANDOM",
    "GREATEST",
    "LEAST",
    "SIGN",
    "TRUNC",
    "LOG",
    "LN",
    "EXP",
  ],
  json: [
    "JSON_BUILD_OBJECT",
    "JSONB_BUILD_OBJECT",
    "JSON_BUILD_ARRAY",
    "JSONB_BUILD_ARRAY",
    "JSON_EXTRACT_PATH",
    "JSONB_EXTRACT_PATH",
    "JSON_EXTRACT_PATH_TEXT",
    "JSONB_EXTRACT_PATH_TEXT",
    "JSONB_SET",
    "JSONB_INSERT",
    "JSONB_PRETTY",
    "ROW_TO_JSON",
    "TO_JSON",
    "TO_JSONB",
  ],
  type_cast: [
    "CAST",
    "COALESCE",
    "NULLIF",
    "GREATEST",
    "LEAST",
  ],
  misc: [
    "GEN_RANDOM_UUID",
    "NEXTVAL",
    "CURRVAL",
    "SETVAL",
    "PG_TYPEOF",
    "ARRAY_LENGTH",
    "UNNEST",
    "GENERATE_SERIES",
  ],
} as const;

/** Flat list of all function names for quick lookups. */
export const ALL_FUNCTIONS: string[] = Object.values(PG_FUNCTIONS).flat();

/** Set of all SQL keywords (upper-cased) for the tokenizer. */
export const SQL_KEYWORD_SET: Set<string> = new Set([
  ...STATEMENT_KEYWORDS,
  ...CLAUSE_KEYWORDS,
  ...ALL_FUNCTIONS,
]);
