<script setup lang="ts">
import ResultsFallback from "./ResultsFallback.vue";
import ResultsHeader from "./ResultsHeader.vue";
import ResultsTable from "./ResultsTable.vue";
import type { QueryResult, PgError } from "../../types";

defineProps<{
  results: QueryResult | null;
  error: PgError | null;
  isExecuting: boolean;
}>();

defineEmits<{
  "copy-cell": [e: MouseEvent, value: unknown];
}>();
</script>

<template>
  <div flex-1 flex flex-col min-h-0 bg-gray-950>
    <!-- Results Header -->
    <ResultsHeader
      :results="results"
      :error="error"
      :isExecuting="isExecuting"
    />

    <ResultsTable
      v-if="results && results.columns.length > 0"
      :columns="results.columns"
      :rows="results.rows"
      @copy-cell="(e, val) => $emit('copy-cell', e, val)"
    />

    <ResultsFallback
      v-else
      :results="results"
      :error="error"
      :isExecuting="isExecuting"
    />
  </div>
</template>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
