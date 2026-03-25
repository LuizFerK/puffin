import * as monaco from "monaco-editor";
import type { Ref } from "vue";

/**
 * Registers a SQL completion provider that suggests table and column names
 * based on the introspected schema info.
 *
 * Call `dispose()` when tearing down the editor.
 */
export function useSchemaCompletion(
  schemaInfo: Ref<Record<string, string[]> | null>
) {
  const provider = monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [" ", ".", ","],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: monaco.languages.CompletionItem[] = [];

      if (schemaInfo.value) {
        for (const [table, columns] of Object.entries(schemaInfo.value)) {
          suggestions.push({
            label: table,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table,
            range,
            detail: "Table",
          });

          for (const col of columns) {
            suggestions.push({
              label: col,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col,
              range,
              detail: `Column in ${table}`,
            });
          }
        }
      }

      return { suggestions };
    },
  });

  function dispose() {
    provider.dispose();
  }

  return { dispose };
}
