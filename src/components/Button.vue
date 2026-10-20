<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    icon?: string
    variant?: "primary" | "secondary" | "danger" | "ghost-danger"
  }>(),
  {
    variant: "secondary",
  },
)

const buttonClass = computed(() => {
  if (props.variant === "primary") {
    return "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
  }
  if (props.variant === "danger") {
    return "bg-red-500/10 text-red-400 hover:bg-red-500/20"
  }
  if (props.variant === "ghost-danger") {
    return "bg-transparent text-gray-400 hover:text-red-400 hover:bg-red-500/10"
  }
  return "bg-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5"
})
</script>

<template>
  <button
    flex
    items-center
    gap-2
    h-fit
    px-3
    py-2
    rounded-lg
    transition-colors
    duration-200
    cursor-pointer
    text-sm
    font-medium
    outline-none
    disabled:opacity-40
    disabled:pointer-events-none
    :class="buttonClass"
  >
    <div v-if="icon" :class="icon"></div>
    <slot />
  </button>
</template>
