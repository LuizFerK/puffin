import * as monaco from "monaco-editor"
import type { Ref } from "vue"
import type { QuerySegment } from "./useQuerySelector"
import { getSqlSuggestions, type SuggestionKind } from "./sql/sqlSuggestions"

function mapKind(kind: SuggestionKind): monaco.languages.CompletionItemKind {
  switch (kind) {
    case "table":
      return monaco.languages.CompletionItemKind.Class
    case "column":
      return monaco.languages.CompletionItemKind.Field
    case "function":
      return monaco.languages.CompletionItemKind.Function
    case "keyword":
      return monaco.languages.CompletionItemKind.Keyword
    case "operator":
      return monaco.languages.CompletionItemKind.Operator
  }
}

/**
 * Registers a context-aware SQL completion provider.
 * Delegates actual suggestion matching to the pure function `getSqlSuggestions`
 * so the core logic can be unit tested without Monaco.
 */
export function useSchemaCompletion(
  schemaInfo: Ref<Record<string, string[]> | null>,
  getSegmentAtCursor: () => QuerySegment | null,
) {
  const provider = monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [" ", ".", ",", "*"],
    provideCompletionItems: (model, position) => {
      const segment = getSegmentAtCursor()
      if (!segment) {
        return { suggestions: [] }
      }

      const absoluteCursor = model.getOffsetAt(position)
      const relativeCursor = absoluteCursor - segment.start

      if (relativeCursor < 0) {
        return { suggestions: [] }
      }

      // 1. Get pure suggestions
      const rawSuggestions = getSqlSuggestions(
        segment.text,
        relativeCursor,
        schemaInfo.value,
      )

      // 2. Map to Monaco completion items
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const suggestions: monaco.languages.CompletionItem[] = rawSuggestions.map(
        (s) => ({
          label: s.label,
          kind: mapKind(s.kind),
          insertText: s.insertText,
          insertTextRules: s.isSnippet
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          detail: s.detail,
          range,
        }),
      )

      return { suggestions }
    },
  })

  return { dispose: () => provider.dispose() }
}
