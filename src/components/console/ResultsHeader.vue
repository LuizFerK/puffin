<script setup lang="ts">
import type { QueryResult } from "./ResultsPanel.vue";

defineProps<{
  results: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
}>();
</script>

<template>
  <div
    h-10
    border-b
    border-gray-800
    flex
    items-center
    px-4
    gap-5
    text-xs
    text-gray-400
    shrink-0
  >
    <span font-medium text-gray-300>Results</span>

    <template v-if="isExecuting">
      <div flex items-center gap-1.5 text-yellow-500 font-medium>
        <div i-lucide-loader-2 text-xs class="animate-spin"></div>
        Running...
      </div>
    </template>

    <template v-else-if="error">
      <div flex items-center gap-1.5 text-red-400 font-medium>
        <div i-lucide-x-circle text-xs></div>
        Error
      </div>
    </template>

    <template v-else-if="results">
      <div flex items-center gap-1.5 text-emerald-500 font-medium>
        <div i-lucide-check-circle text-xs></div>
        Success
      </div>
      <div flex items-center gap-1.5>
        <div i-lucide-align-justify text-xs></div>
        {{ results.row_count }} rows
      </div>
      <div flex items-center gap-1.5>
        <div i-lucide-clock text-xs></div>
        {{ results.elapsed_ms }}ms
      </div>
    </template>

    <template v-else>
      <span text-gray-600>Run a query to see results</span>
    </template>
  </div>
</template>