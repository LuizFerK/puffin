<script setup lang="ts">
import Button from "../Button.vue"
import HistoryListItem from "./HistoryListItem.vue"
import type { HistoryQuery } from "../../types"

defineProps<{
  queries: HistoryQuery[]
  activeQueryId: number | null
}>()

defineEmits<{
  hover: [id: number]
  delete: [query: HistoryQuery]
  copy: [query: HistoryQuery]
  clearAll: []
}>()
</script>

<template>
  <div w-80 border-r border-gray-800 flex flex-col shrink-0>
    <!-- Header -->
    <div p-4 py-5 border-b border-gray-800 flex items-center justify-between>
      <div>
        <h2 text-sm font-semibold text-gray-200>History</h2>
        <p text-xs text-gray-500 mt-1.5>{{ queries.length }} queries</p>
      </div>
      <Button
        v-if="queries.length > 0"
        icon="i-lucide-trash"
        variant="secondary"
        class="hover:!text-red-400 hover:!bg-red-500/10 px-2!"
        @click="$emit('clearAll')"
      />
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
        <div i-lucide-history text-4xl></div>
        <p text-sm>No query history yet</p>
        <p text-xs text-gray-700>Run queries from the console</p>
      </div>

      <HistoryListItem
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
