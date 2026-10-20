<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { validateCellText } from "../../helpers/cellHelpers"

const props = defineProps<{
  initialText: string
  typeName: string
}>()

const emit = defineEmits<{
  commit: [text: string]
  cancel: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const text = ref(props.initialText)
const error = computed(() => validateCellText(props.typeName, text.value))

function onEnter() {
  if (!error.value) emit("commit", text.value)
}

function onBlur() {
  if (error.value) emit("cancel")
  else emit("commit", text.value)
}

onMounted(() => {
  inputRef.value?.focus()
  inputRef.value?.select()
})
</script>

<template>
  <input
    ref="inputRef"
    v-model="text"
    type="text"
    spellcheck="false"
    w-full
    py-2.5
    px-4
    bg-gray-900
    text-xs
    font-mono
    text-gray-200
    border-none
    outline-none
    class="cell-editor"
    :class="{ invalid: error }"
    :title="error ?? undefined"
    @keydown.enter.prevent="onEnter"
    @keydown.esc.stop.prevent="emit('cancel')"
    @blur="onBlur"
  />
</template>

<style scoped>
/* Inset ring instead of a border so the row height doesn't change while editing */
.cell-editor {
  box-shadow: inset 0 0 0 1px #047857;
}

.cell-editor.invalid {
  box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.7);
}
</style>
