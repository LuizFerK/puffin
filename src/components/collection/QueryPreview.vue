<script setup lang="ts">
import SqlHighlighter from "../SqlHighlighter.vue";
import type { SavedQuery } from "../../types";

defineProps<{
  query: SavedQuery | undefined;
}>();
</script>

<template>
  <div flex-1 flex flex-col min-w-0>
    <div h-full flex flex-col>
      <!-- Topbar -->
      <div
        h-12
        border-b
        border-gray-800
        flex
        items-center
        px-4
        gap-2
        text-xs
        text-gray-400
        shrink-0
      >
        <div i-lucide-code-2 text-sm></div>
        <span font-medium text-gray-400>{{
          query?.name || "Hover a query to preview"
        }}</span>
      </div>

      <!-- Editor Content -->
      <div
        v-if="query"
        bg="[#0d1117]"
        flex-1
        p-6
        overflow-y-auto
        overflow-x-hidden
      >
        <SqlHighlighter
          font-mono
          text-sm
          leading-6
          whitespace-pre-wrap
          break-words
          :sql="query.code"
        />
      </div>

      <div
        v-else
        flex-1
        flex
        flex-col
        items-center
        justify-center
        text-gray-600
        text-sm
      >
        <div i-lucide-code-2 text-3xl text-gray-800 mb-4></div>
        <div bg-gray-950>Hover a query on the left to preview it here</div>
      </div>
    </div>
  </div>
</template>
