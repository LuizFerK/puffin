<script setup lang="ts">
import { ref, computed } from 'vue'

import SqlHighlighter from '../components/SqlHighlighter.vue'

const collection = ref([
  { id: 1, name: 'All users', connection: 'Production DB', date: '2026-03-18', code: 'SELECT * FROM users ORDER BY created_at DESC LIMIT 100;' },
  { id: 2, name: 'Active sessions', connection: 'Production DB', date: '2026-03-19', code: "SELECT * FROM pg_stat_activity WHERE state = 'active';" },
  { id: 3, name: 'Table sizes', connection: 'Staging DB', date: '2026-03-20', code: 'SELECT relname as "Table", pg_size_pretty(pg_total_relation_size(relid)) As "Size", pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as "External Size" FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;' }
])

const activeQueryId = ref<number | null>(1)

const activeQuery = computed(() => {
  return collection.value.find(q => q.id === activeQueryId.value)
})

function onHover(id: number) {
  activeQueryId.value = id
}
</script>

<template>
  <div w-full h-full flex bg-gray-950 font-sans text-gray-300>
    
    <!-- Sidebar List -->
    <div w-80 border-r border-gray-800 flex flex-col shrink-0>
      <!-- Header -->
      <div p-4 py-5 border-b border-gray-800>
        <h2 text-sm font-semibold text-gray-200>Saved Queries</h2>
        <p text-xs text-gray-500 mt-1.5>{{ collection.length }} queries</p>
      </div>
      
      <!-- List Items -->
      <div flex-1 overflow-y-auto bg-gray="900/20">
        <div v-for="query in collection" :key="query.id"
          @mouseenter="onHover(query.id)"
          p-4 py-3 flex gap-3 cursor-default transition-colors border-l-2 items-center
          :class="activeQueryId === query.id ? 'bg-white/5 border-emerald-500/50' : 'hover:bg-white/5 border-transparent'">
          
          <div i-lucide-bookmark text-yellow="600/80" mt-0.5></div>
          <div flex-1 flex flex-col gap-1>
            <span text-sm font-medium text-gray-200>{{ query.name }}</span>
            <div text-xs flex items-center gap-2>
              <span px-1 pt-0.5 rounded bg-gray-800 text="[10px]" text-gray-400 border border-gray-700>{{ query.connection }}</span>
              <span text-gray-600 font-mono text-xs mt-0.5>{{ query.date }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Editor Preview Pane -->
    <div flex-1 flex flex-col bg="[#0d1117]" min-w-0>
      <div v-if="activeQuery" h-full flex flex-col>
        <!-- Topbar -->
        <div h-12 border-b border-gray-800 flex items-center px-4 gap-2 text-xs text-gray-400 shrink-0>
          <div i-lucide-code-2 text-sm></div>
          <span font-medium text-gray-400>{{ activeQuery.name }}</span>
        </div>
        
        <!-- Editor Content -->
        <div flex-1 p-6 overflow-y-auto overflow-x-hidden>
          <SqlHighlighter font-mono text-sm leading-6 whitespace-pre-wrap break-words :sql="activeQuery.code" />
        </div>
      </div>
      
      <div v-else flex-1 flex items-center justify-center text-gray-600 text-sm>
        Hover over a query to see the code
      </div>
    </div>
    
  </div>
</template>
