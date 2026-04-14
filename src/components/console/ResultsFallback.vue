<script setup lang="ts">
import type { QueryResult, PgError } from "../../types";
import { capitalize } from "../../helpers/stringHelpers";

defineProps<{
  results: QueryResult | null;
  error: PgError | null;
  isExecuting: boolean;
}>();
</script>

<template>
  <div flex-1 flex flex-col items-center justify-center text-gray-600>
    <!-- Loading state -->
    <div v-if="isExecuting" i-lucide-loader-2 text-3xl class="animate-spin"></div>

    <!-- Error state -->
    <template v-else-if="error">
      <div i-lucide-x-circle text-3xl text-red-500 mb-2></div>
      <span text-sm text-red-400>{{ capitalize(error.detail) }}</span>
      <span v-if="error.hint" text-xs text-red-500 opacity-70 mt-1>{{ error.hint }}</span>
    </template>

    <!-- Empty state -->
    <template v-else-if="results && results.columns.length === 0">
      <div i-lucide-check-circle text-3xl text-emerald-600 mb-2></div>
        <span text-sm>Query executed successfully</span>
        <span text-xs text-gray-700 mt-1>
          {{ results.row_count }} rows
        </span>
    </template>

    <!-- No results yet -->
    <template v-else>
      <div i-lucide-terminal text-3xl text-gray-800 mb-3></div>
      <span text-sm>Run a query to see results here</span>
    </template>
  </div>
</template>