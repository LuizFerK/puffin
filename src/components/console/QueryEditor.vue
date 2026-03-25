<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { useQueryStore } from "../../stores/queryStore";

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

const props = defineProps<{
  modelValue: string;
  height: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "execute": [query: string];
}>();

const editorContainer = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

const store = useQueryStore();
let completionProvider: monaco.IDisposable | null = null;

onMounted(() => {
  if (!editorContainer.value) return;

  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: "sql",
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "monospace",
    scrollBeyondLastLine: false,
  });

  monaco.editor.defineTheme("puffin-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0d1117",
    },
  });

  monaco.editor.setTheme("puffin-dark");

  editor.onDidChangeModelContent(() => {
    emit("update:modelValue", editor?.getValue() || "");
  });

  // Bind Ctrl+Enter (Cmd+Enter on Mac) to execute
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    const query = getQueryAtCursor();
    if (query) emit("execute", query);
  });

  // Register completion provider
  completionProvider = monaco.languages.registerCompletionItemProvider("sql", {
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

      if (store.schemaInfo.value) {
        for (const [table, columns] of Object.entries((store.schemaInfo.value as Record<string, string[]>))) {
          // Add table suggestion
          suggestions.push({
            label: table,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table,
            range,
            detail: "Table",
          });

          // Add column suggestions
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
});

function getQueryAtCursor(): string | null {
  if (!editor) return null;

  const model = editor.getModel();
  if (!model) return null;

  const fullText = model.getValue();
  const position = editor.getPosition();
  if (!position) return null;

  const cursorOffset = model.getOffsetAt(position);

  // Split the text into segments by semicolons or double-newlines.
  // We walk through and record each segment's start/end offsets.
  const segments: { start: number; end: number; text: string }[] = [];
  const regex = /;|\n\s*\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(fullText)) !== null) {
    const segText = fullText.slice(lastIndex, match.index);
    if (segText.trim()) {
      segments.push({ start: lastIndex, end: match.index, text: segText.trim() });
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last delimiter
  const remaining = fullText.slice(lastIndex);
  if (remaining.trim()) {
    segments.push({ start: lastIndex, end: fullText.length, text: remaining.trim() });
  }

  // If no segments found, treat the entire text as a single query
  if (segments.length === 0) {
    return fullText.trim() || null;
  }

  // Find the segment that contains the cursor offset
  for (const seg of segments) {
    if (cursorOffset >= seg.start && cursorOffset <= seg.end) {
      return seg.text;
    }
  }

  // Cursor is between segments (e.g. on a blank line) — find the nearest one
  let nearest = segments[0];
  let minDist = Infinity;
  for (const seg of segments) {
    const dist = Math.min(
      Math.abs(cursorOffset - seg.start),
      Math.abs(cursorOffset - seg.end)
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = seg;
    }
  }
  return nearest.text;
}

defineExpose({ getQueryAtCursor });

watch(
  () => props.modelValue,
  (newValue) => {
    if (editor && editor.getValue() !== newValue) {
      editor.setValue(newValue);
    }
  }
);

onBeforeUnmount(() => {
  if (completionProvider) {
    completionProvider.dispose();
  }
  if (editor) {
    editor.dispose();
  }
});
</script>

<template>
  <div
    class="w-full"
    :style="{ height: height + 'px' }"
    bg="[#0d1117]"
  >
    <div ref="editorContainer" class="w-full h-full"></div>
  </div>
</template>
