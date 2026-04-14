<script setup lang="ts">
import type { QueryResult } from "./ResultsPanel.vue";

defineProps<{
  results: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
}>();
</script>

<template>
  <div flex-1 flex flex-col items-center justify-center text-gray-600>
    <!-- Loading state -->
    <div v-if="isExecuting" i-lucide-loader-2 text-xl class="animate-spin"></div>

    <!-- Error state -->
    <div
      v-else-if="error"
      bg-red="500/5"
      border
      border-red="500/20"
      rounded-lg
      p-4
      text-sm
      text-red-400
      font-mono
      whitespace-pre-wrap
    >
      {{ error }}
    </div>

    <!-- Empty state -->
    <template v-else-if="results && results.columns.length === 0">
      <div i-lucide-check-circle text-2xl text-emerald-600 mb-2></div>
        <span text-sm>Query executed successfully</span>
        <span text-xs text-gray-700 mt-1>
          {{ results.row_count }} rows affected
        </span>
    </template>

    <!-- No results yet -->
    <template v-else>
      <div i-lucide-terminal text-3xl text-gray-800 mb-3></div>
      <span text-sm>Run a query to see results here</span>
    </template>
  </div>
</template>