<script setup lang="ts">
import QueryListItem from "./QueryListItem.vue";
import type { SavedQuery } from "../../types";

defineProps<{
  queries: SavedQuery[];
  activeQueryId: number | null;
}>();

defineEmits<{
  hover: [id: number];
  delete: [query: SavedQuery];
  copy: [query: SavedQuery];
}>();
</script>

<template>
  <div w-80 border-r border-gray-800 flex flex-col shrink-0>
    <!-- Header -->
    <div p-4 py-5 border-b border-gray-800>
      <h2 text-sm font-semibold text-gray-200>Collection</h2>
      <p text-xs text-gray-500 mt-1.5>{{ queries.length }} queries</p>
    </div>

    <!-- List Items -->
    <div flex-1 overflow-y-auto bg-gray="900/20">
      <div
        v-if="queries.length === 0"
        flex
        flex-col
        items-center
        justify-center
        gap-3
        mt-16
        text-gray-600
      >
        <div i-lucide-bookmark text-4xl></div>
        <p text-sm>No saved queries yet</p>
        <p text-xs text-gray-700>Save queries from the console</p>
      </div>

      <QueryListItem
        v-for="query in queries"
        :key="query.id"
        :query="query"
        :is-active="activeQueryId === query.id"
        @hover="$emit('hover', query.id)"
        @delete="$emit('delete', query)"
        @copy="$emit('copy', query)"
      />
    </div>
  </div>
</template>
