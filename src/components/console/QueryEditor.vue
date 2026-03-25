<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { useQueryStore } from "../../stores/queryStore";
import { useQuerySelector } from "../../composables/useQuerySelector";
import { useSchemaCompletion } from "../../composables/useSchemaCompletion";

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

const { schemaInfo } = useQueryStore();
let querySelector: ReturnType<typeof useQuerySelector> | null = null;
let schemaCompletion: ReturnType<typeof useSchemaCompletion> | null = null;

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

  // Set up query selector (highlight + cursor detection)
  querySelector = useQuerySelector(editor);

  // Set up schema-based completions
  schemaCompletion = useSchemaCompletion(schemaInfo);

  editor.onDidChangeModelContent(() => {
    emit("update:modelValue", editor?.getValue() || "");
  });

  // Bind Ctrl+Enter (Cmd+Enter on Mac) to execute
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    const query = querySelector?.getQueryAtCursor();
    if (query) emit("execute", query);
  });
});

function getQueryAtCursor(): string | null {
  return querySelector?.getQueryAtCursor() ?? null;
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
  querySelector?.dispose();
  schemaCompletion?.dispose();
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

<style>
/* Active query background highlight */
.active-query-highlight {
  background-color: rgba(30, 80, 60, 0.15);
}

/* Left gutter bar indicator */
.active-query-gutter {
  background-color: #10b981;
  width: 2px !important;
  margin-left: 3px;
}
</style>

