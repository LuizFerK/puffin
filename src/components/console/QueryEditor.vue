<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue"
import * as monaco from "monaco-editor"
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import { useQueryStore } from "../../stores/queryStore"
import { useQuerySelector } from "../../composables/useQuerySelector"
import { useSchemaCompletion } from "../../composables/useSchemaCompletion"
import { useSettingsStore } from "../../stores/settingsStore"
import { initVimMode, StatusBar } from "monaco-vim"
import VimStatusBar, { type VimModeState } from "./VimStatusBar.vue"

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
}

const props = defineProps<{
  modelValue: string
  height: number
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string]
  formatQuery: []
  execute: [query: string]
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const { schemaInfo } = useQueryStore()
const { syntaxColors, vimMode } = useSettingsStore()
let querySelector: ReturnType<typeof useQuerySelector> | null = null
let schemaCompletion: ReturnType<typeof useSchemaCompletion> | null = null

const vimStatusBar = ref<InstanceType<typeof VimStatusBar> | null>(null)
const vimModeState = ref<VimModeState>({ mode: "normal" })
let vim: { dispose(): void } | null = null

// The mode badge is rendered by VimStatusBar; the rest of monaco-vim's status bar stays as is
class ModeAwareStatusBar extends StatusBar {
  setMode(ev: VimModeState) {
    vimModeState.value = ev
  }
}

function applyTheme() {
  const colors = syntaxColors.value
  monaco.editor.defineTheme("puffin-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword.sql", foreground: colors.keyword.replace("#", "") },
      { token: "operator.sql", foreground: colors.keyword.replace("#", "") },
      { token: "predefined.sql", foreground: colors.function.replace("#", "") },
      { token: "string.sql", foreground: colors.string.replace("#", "") },
      { token: "number.sql", foreground: colors.number.replace("#", "") },
      {
        token: "comment.sql",
        foreground: colors.comment.replace("#", ""),
        fontStyle: "italic",
      },
      { token: "type.sql", foreground: colors.type.replace("#", "") },
      { token: "delimiter.sql", foreground: colors.punct.replace("#", "") },
      { token: "identifier.sql", foreground: colors.ident.replace("#", "") },
    ],
    colors: {
      "editor.background": "#0d1117",
    },
  })
  monaco.editor.setTheme("puffin-dark")
}

function setVimMode(enabled: boolean) {
  vim?.dispose()
  const container = vimStatusBar.value?.container
  vim = enabled && editor && container ? initVimMode(editor, container, ModeAwareStatusBar) : null
}

onMounted(() => {
  if (!editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: "sql",
    automaticLayout: true,
    fontSize: 14,
    // Only schema-aware suggestions; words from the buffer are mostly noise in SQL
    wordBasedSuggestions: "off",
    quickSuggestions: { other: true, comments: false, strings: false },
    suggest: { showWords: false, insertMode: "replace" },
    fontFamily: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace",
    scrollBeyondLastLine: false,
  })

  applyTheme()

  // Monaco caches glyph widths at creation; if the font finishes loading later the cursor drifts.
  document.fonts.ready.then(() => monaco.editor.remeasureFonts())

  // Set up query selector (highlight + cursor detection)
  querySelector = useQuerySelector(editor)

  schemaCompletion = useSchemaCompletion(editor, schemaInfo)

  editor.onDidChangeModelContent(() => {
    emit("update:modelValue", editor?.getValue() || "")
  })

  // Bind Ctrl+Enter (Cmd+Enter on Mac) to execute
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    const query = querySelector?.getQueryAtCursor()
    if (query) emit("execute", query)
  })

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    emit('formatQuery')
  })

  setVimMode(vimMode.value)
})

// Re-apply theme whenever user changes syntax colors
watch(syntaxColors, () => applyTheme(), { deep: true })

watch(vimMode, setVimMode)

function getQueryAtCursor(): string | null {
  return querySelector?.getQueryAtCursor() ?? null
}

defineExpose({ getQueryAtCursor })

watch(
  () => props.modelValue,
  (newValue) => {
    if (editor && editor.getValue() !== newValue) {
      editor.setValue(newValue)
    }
  },
)

onBeforeUnmount(() => {
  // vim hooks into the editor's listeners, so it goes before the editor
  vim?.dispose()
  querySelector?.dispose()
  schemaCompletion?.dispose()
  if (editor) {
    editor.dispose()
  }
})
</script>

<template>
  <div class="w-full flex flex-col" :style="{ height: height + 'px' }" bg="[#0d1117]">
    <div ref="editorContainer" class="w-full flex-1 min-h-0"></div>

    <VimStatusBar v-show="vimMode" ref="vimStatusBar" :mode="vimModeState" />
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
