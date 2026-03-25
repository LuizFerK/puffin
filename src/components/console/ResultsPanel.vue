<script setup lang="ts">
import ResultsTable from "./ResultsTable.vue";

interface QueryResult {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  row_count: number;
  elapsed_ms: number;
}

defineProps<{
  results: QueryResult | null;
  error: string | null;
  isExecuting: boolean;
}>();

defineEmits<{
  "copy-cell": [e: MouseEvent, value: unknown];
}>();
</script>

<template>
  <div flex-1 flex flex-col min-h-0 bg-gray-950>
    <!-- Results Header -->
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

    <!-- Error Display -->
    <div v-if="error" flex-1 p-4 overflow-auto>
      <div
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
    </div>

    <!-- Table Wrapper -->
    <ResultsTable
      v-else-if="results && results.columns.length > 0"
      :columns="results.columns"
      :rows="results.rows"
      @copy-cell="(e, val) => $emit('copy-cell', e, val)"
    />

    <!-- Empty state -->
    <div
      v-else-if="results && results.columns.length === 0"
      flex-1
      flex
      flex-col
      items-center
      justify-center
      text-gray-600
    >
      <div i-lucide-check-circle text-2xl text-emerald-600 mb-2></div>
      <span text-sm>Query executed successfully</span>
      <span text-xs text-gray-700 mt-1
        >{{ results.row_count }} rows affected</span
      >
    </div>

    <!-- No results yet -->
    <div v-else flex-1 flex flex-col items-center justify-center text-gray-600>
      <div i-lucide-terminal text-3xl text-gray-800 mb-3></div>
      <span text-sm>Run a query to see results here</span>
    </div>
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
