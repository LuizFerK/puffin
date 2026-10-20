<script setup lang="ts">
defineProps<{
  selected?: boolean
}>()
</script>

<template>
  <button
    flex
    gap-3
    px-3
    py-2.5
    rounded-lg
    border
    text-left
    cursor-pointer
    outline-none
    transition-colors
    duration-150
    :class="
      selected
        ? 'bg-emerald-500/5 border-emerald-500/40'
        : 'bg-transparent border-gray-800 hover:border-gray-700 hover:bg-white/3'
    "
  >
    <slot />
  </button>
</template>
