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
  "execute": [];
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
    emit("execute");
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
