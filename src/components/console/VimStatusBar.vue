<script setup lang="ts">
import { computed, ref } from "vue"

export interface VimModeState {
  mode: string
  subMode?: string
}

const props = defineProps<{
  mode: VimModeState
}>()

// Full class strings so UnoCSS can extract them
const MODE_STYLES: Record<string, { label: string; classes: string }> = {
  normal: { label: "NORMAL", classes: "bg-emerald-500/15 text-emerald-400" },
  insert: { label: "INSERT", classes: "bg-blue-500/15 text-blue-400" },
  visual: { label: "VISUAL", classes: "bg-purple-500/15 text-purple-400" },
  replace: { label: "REPLACE", classes: "bg-red-500/15 text-red-400" },
}

const VISUAL_LABELS: Record<string, string> = {
  linewise: "V-LINE",
  blockwise: "V-BLOCK",
}

const modeStyle = computed(() => {
  const style = MODE_STYLES[props.mode.mode] ?? {
    label: props.mode.mode.toUpperCase(),
    classes: "bg-gray-500/15 text-gray-400",
  }
  const label =
    props.mode.mode === "visual" && props.mode.subMode
      ? (VISUAL_LABELS[props.mode.subMode] ?? style.label)
      : style.label
  return { ...style, label }
})

// monaco-vim renders the ex command input, notifications and key buffer in here
const container = ref<HTMLElement | null>(null)

defineExpose({ container })
</script>

<template>
  <div
    class="vim-status-bar h-5 shrink-0 flex items-center text-xs font-mono border-t border-gray-800 text-gray-400"
  >
    <span
      class="h-full flex items-center px-2 font-medium transition-colors duration-100"
      :class="modeStyle.classes"
    >
      {{ modeStyle.label }}
    </span>
    <div ref="container" class="flex-1 min-w-0 px-2 whitespace-pre overflow-hidden"></div>
  </div>
</template>

<style scoped>
.vim-status-bar :deep(input) {
  background: transparent;
  border: none;
  outline: none;
  color: inherit;
  font: inherit;
  padding: 0;
}
</style>
