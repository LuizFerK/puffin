<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import * as monaco from "monaco-editor"
import { validateCellText } from "../../helpers/cellHelpers"
import Button from "../Button.vue"
import Modal from "../Modal.vue"

const props = defineProps<{
  open: boolean
  columnName: string
  typeName: string
  initialText: string
  isNull: boolean
  nullable: boolean
  readOnly: string | null
}>()

const emit = defineEmits<{
  close: []
  copy: [e: MouseEvent]
  save: [text: string]
  setNull: []
}>()

const container = ref<HTMLElement | null>(null)
const text = ref("")
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const error = computed(() => validateCellText(props.typeName, text.value))
const canSave = computed(
  () => props.readOnly === null && error.value === null && text.value !== props.initialText,
)

// The container only exists while the modal is open, so the editor follows it.
// The theme is global in Monaco and already set by the query editor on this page.
watch(container, (el) => {
  editor?.dispose()
  editor = null
  if (!el) return

  text.value = props.initialText
  const isJson = props.typeName === "json" || props.typeName === "jsonb"
  editor = monaco.editor.create(el, {
    value: props.initialText,
    language: isJson ? "json" : "plaintext",
    readOnly: props.readOnly !== null,
    automaticLayout: true,
    fontSize: 13,
    fontFamily: "'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: isJson ? "off" : "on",
    quickSuggestions: false,
  })
  editor.onDidChangeModelContent(() => (text.value = editor?.getValue() ?? ""))
  editor.focus()
})

onBeforeUnmount(() => editor?.dispose())

function save() {
  if (canSave.value) emit("save", text.value)
}
</script>

<template>
  <Modal :open="open" wide :title="columnName" @close="emit('close')">
    <div flex flex-col gap-3>
      <div flex items-center gap-3 text-xs font-mono>
        <span text-gray-500>{{ typeName }}</span>
        <span v-if="isNull" text-gray-600 italic>NULL</span>
        <span v-if="readOnly" flex items-center gap-1 text-gray-500>
          <span i-lucide-lock></span>{{ readOnly }}
        </span>
        <span v-else-if="error" text-red-400>{{ error }}</span>
      </div>
      <div ref="container" h="[60vh]" border border-gray-800 rounded-lg overflow-hidden></div>
    </div>

    <template #footer>
      <Button variant="secondary" icon="i-lucide-copy" @click="emit('copy', $event)">Copy</Button>
      <div flex-1></div>
      <Button
        v-if="readOnly === null && nullable && !isNull"
        variant="secondary"
        icon="i-lucide-circle-slash"
        @click="emit('setNull')"
      >
        Set NULL
      </Button>
      <Button variant="secondary" @click="emit('close')">Close</Button>
      <Button
        v-if="readOnly === null"
        variant="primary"
        icon="i-lucide-check"
        :disabled="!canSave"
        @click="save"
      >
        Save
      </Button>
    </template>
  </Modal>
</template>
