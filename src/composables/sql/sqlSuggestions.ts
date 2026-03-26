import { analyzeQueryContext, SqlState } from "./sqlStateMachine";
import { STATEMENT_KEYWORDS, CLAUSE_KEYWORDS, ALL_FUNCTIONS } from "./sqlKeywords";

export type SuggestionKind = "keyword" | "table" | "column" | "function" | "operator";

export interface SqlSuggestion {
  label: string;
  kind: SuggestionKind;
  detail: string;
  insertText: string;
  isSnippet?: boolean;
}

/**
 * Pure function that generates SQL suggestions for a given query text,
 * cursor position, and database schema, independent of any UI/editor code.
 */
export function getSqlSuggestions(
  sql: string,
  cursorOffset: number,
  schemaInfo: Record<string, string[]> | null
): SqlSuggestion[] {
  const context = analyzeQueryContext(sql, cursorOffset);
  console.log(context)
  const suggestions: SqlSuggestion[] = [];

  const matches = (text: string) =>
    text.toUpperCase().startsWith(context.currentWord.toUpperCase());

  const addTables = () => {
    if (!schemaInfo) return;
    for (const table of Object.keys(schemaInfo)) {
      if (matches(table)) {
        suggestions.push({
          label: table,
          kind: "table",
          insertText: table,
          detail: "Table",
        });
      }
    }
  };

  const addColumns = (limitToTables?: Iterable<string>) => {
    if (!schemaInfo) return;
    const tablesToSearch = limitToTables
      ? [...new Set(Array.from(limitToTables))]
      : Object.keys(schemaInfo);

    for (const table of tablesToSearch) {
      const columns = schemaInfo[table] || [];
      for (const col of columns) {
        if (matches(col)) {
          suggestions.push({
            label: col,
            kind: "column",
            insertText: col,
            detail: `Column in ${table}`,
          });
        }
      }
    }
  };

  const addFunctions = () => {
    for (const func of ALL_FUNCTIONS) {
      if (matches(func)) {
        suggestions.push({
          label: func,
          kind: "function",
          insertText: `${func}($1)`,
          isSnippet: true,
          detail: "Function",
        });
      }
    }
  };

  const addKeywords = (keywords: readonly string[]) => {
    for (const kw of keywords) {
      if (matches(kw)) {
        suggestions.push({
          label: kw,
          kind: "keyword",
          insertText: `${kw} `,
          detail: "Keyword",
        });
      }
    }
  };

  switch (context.state) {
    case SqlState.INITIAL:
      addKeywords(STATEMENT_KEYWORDS);
      break;

    case SqlState.SELECT_FIELDS:
      if (context.referencedTables.size > 0) {
        addColumns(context.referencedTables.values());
      } else {
        addColumns(); // All columns if no tables referenced yet
      }
      addFunctions();
      break;

    case SqlState.CLAUSE:
      addKeywords(CLAUSE_KEYWORDS);
      break;

    case SqlState.FROM_CLAUSE:
    case SqlState.INSERT_TABLE:
    case SqlState.UPDATE_TABLE:
    case SqlState.DELETE_TABLE:
      addTables();
      break;

    case SqlState.WHERE_CLAUSE:
    case SqlState.ORDER_GROUP_BY:
      console.log(context.referencedTables)
      if (context.referencedTables.size > 0) {
        addColumns(context.referencedTables.values());
      } else {
        addColumns();
      }
      addFunctions();
      break;

    case SqlState.SET_CLAUSE:
    case SqlState.INSERT_COLUMNS:
      if (context.targetTable) {
        addColumns([context.targetTable]);
      } else {
        addColumns();
      }
      break;

    case SqlState.VALUES_CLAUSE:
      addFunctions();
      break;

    case SqlState.HAVING_CLAUSE:
      if (context.referencedTables.size > 0) {
        addColumns(context.referencedTables.values());
      } else {
        addColumns();
      }
      addFunctions();
      break;

    case SqlState.DOT_ACCESS:
      if (context.dotPrefix) {
        const realTable = context.referencedTables.get(context.dotPrefix) || context.dotPrefix;
        addColumns([realTable]);
      }
      break;

    case SqlState.GENERIC:
      addKeywords(STATEMENT_KEYWORDS);
      addKeywords(CLAUSE_KEYWORDS);
      addTables();
      addColumns();
      break;
  }

  return suggestions;
}
