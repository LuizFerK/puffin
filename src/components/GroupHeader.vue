<script setup lang="ts">
defineProps<{
  name: string
  count: number
}>()
</script>

<!-- Spacing comes from the caller so each list keeps its own rhythm -->
<template>
  <div flex items-center>
    <h3 m-0 text-xs font-semibold text-gray="400/80" uppercase tracking-widest truncate>
      {{ name }}
    </h3>
    <div flex-1 h-px bg-gray="800/80"></div>
    <span text-xs text-gray-500 font-medium>{{ count }}</span>
  </div>
</template>
