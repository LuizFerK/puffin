<script setup lang="ts">
import { ref } from "vue"

// Extra attributes (spellcheck, listeners...) belong to the input, not the wrapper
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    label?: string
    modelValue: string | number | undefined
    type?: string
    placeholder?: string
    tone?: "default" | "danger"
    mono?: boolean
  }>(),
  { type: "text", tone: "default" },
)

defineEmits<{
  "update:modelValue": [value: string | number | ""]
}>()

const input = ref<HTMLInputElement | null>(null)

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div flex flex-col gap-1>
    <label text-sm text-gray-400 font-medium>
      <slot name="label">{{ label }}</slot>
    </label>
    <input
      ref="input"
      v-bind="$attrs"
      :value="modelValue"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
      :type="type"
      :placeholder="placeholder"
      bg-transparent
      border
      border-gray-800
      rounded-lg
      px-3
      py-2
      text-sm
      text-gray-200
      focus:outline-none
      transition
      :class="[
        tone === 'danger' ? 'focus:border-red-500/50' : 'focus:border-emerald-700',
        { 'font-mono': mono },
      ]"
    />
  </div>
</template>
