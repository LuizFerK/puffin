import * as monaco from "monaco-editor"
import type { Ref } from "vue"
import type { DatabaseSchema } from "../types"
import {
  getCompletions,
  type CompletionItem,
  type ItemKind,
} from "../sql/completion"

const {
  CompletionItemKind,
  CompletionItemInsertTextRule,
  CompletionTriggerKind,
} = monaco.languages

const KINDS: Record<ItemKind, monaco.languages.CompletionItemKind> = {
  column: CompletionItemKind.Field,
  table: CompletionItemKind.Class,
  view: CompletionItemKind.Interface,
  cte: CompletionItemKind.Struct,
  schema: CompletionItemKind.Module,
  alias: CompletionItemKind.Variable,
  function: CompletionItemKind.Function,
  keyword: CompletionItemKind.Keyword,
}

// Typing these opens the popup; for all but "." it's dropped unless it lists tables or columns
const TRIGGER_CHARACTERS = [".", " ", ",", "("]

function toMonacoItem(
  item: CompletionItem,
  range: monaco.languages.CompletionItemRanges,
) {
  return {
    label: {
      label: item.label,
      detail: item.detail ? ` ${item.detail}` : undefined,
      description: item.description,
    },
    kind: KINDS[item.kind],
    insertText: item.insertText,
    insertTextRules: item.isSnippet
      ? CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    filterText: item.filterText,
    sortText: item.sortText,
    range,
  }
}

export function provideCompletions(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  context: monaco.languages.CompletionContext,
  schema: DatabaseSchema | null,
): monaco.languages.CompletionList {
  const offset = model.getOffsetAt(position)
  const result = getCompletions(model.getValue(), offset, schema)

  const typedTrigger =
    context.triggerKind === CompletionTriggerKind.TriggerCharacter &&
    context.triggerCharacter !== "."
  if (typedTrigger && !result.autoTrigger) return { suggestions: [] }

  const start = model.getPositionAt(result.replaceStart)
  const end = model.getPositionAt(result.replaceEnd)
  const range = {
    insert: new monaco.Range(
      start.lineNumber,
      start.column,
      position.lineNumber,
      position.column,
    ),
    replace: new monaco.Range(
      start.lineNumber,
      start.column,
      end.lineNumber,
      end.column,
    ),
  }

  return { suggestions: result.items.map((item) => toMonacoItem(item, range)) }
}

/**
 * Registers schema-aware SQL completion for one editor. The provider is global to
 * the "sql" language, so it ignores models that belong to other editors.
 */
export function useSchemaCompletion(
  editor: monaco.editor.IStandaloneCodeEditor,
  schema: Ref<DatabaseSchema | null>,
) {
  const provider = monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: TRIGGER_CHARACTERS,
    provideCompletionItems: (model, position, context) =>
      model === editor.getModel()
        ? provideCompletions(model, position, context, schema.value)
        : { suggestions: [] },
  })

  return { dispose: () => provider.dispose() }
}
