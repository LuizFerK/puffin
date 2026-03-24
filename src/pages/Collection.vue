<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SqlHighlighter from '../components/SqlHighlighter.vue'
import Button from '../components/Button.vue'
import Modal from '../components/Modal.vue'
import { useQueryStore } from '../stores/queryStore'
import type { SavedQuery } from '../stores/types'

const { savedQueries, loadQueries, removeQuery } = useQueryStore()

onMounted(() => loadQueries())

const activeQueryId = ref<number | null>(null)

const activeQuery = computed(() => {
  return savedQueries.value.find(q => q.id === activeQueryId.value)
})

function onHover(id: number) {
  activeQueryId.value = id
}

// Delete confirmation
const queryToDelete = ref<SavedQuery | null>(null)
const isDeleteModalOpen = ref(false)

function openDeleteModal(query: SavedQuery) {
  queryToDelete.value = query
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  if (queryToDelete.value) {
    await removeQuery(queryToDelete.value.id)
  }
  isDeleteModalOpen.value = false
  queryToDelete.value = null
}
</script>

<template>
  <div w-full h-full flex bg-gray-950 font-sans text-gray-300>
    
    <!-- Sidebar List -->
    <div w-80 border-r border-gray-800 flex flex-col shrink-0>
      <!-- Header -->
      <div p-4 py-5 border-b border-gray-800>
        <h2 text-sm font-semibold text-gray-200>Saved Queries</h2>
        <p text-xs text-gray-500 mt-1.5>{{ savedQueries.length }} queries</p>
      </div>
      
      <!-- List Items -->
      <div flex-1 overflow-y-auto bg-gray="900/20">
        <div v-if="savedQueries.length === 0" flex flex-col items-center justify-center gap-3 mt-16 text-gray-600>
          <div i-lucide-bookmark text-4xl></div>
          <p text-sm>No saved queries yet</p>
          <p text-xs text-gray-700>Save queries from the console</p>
        </div>

        <div v-for="query in savedQueries" :key="query.id"
          class="group"
          @mouseenter="onHover(query.id)"
          p-4 py-3 flex gap-3 cursor-default transition-colors border-l-2 items-center
          :class="activeQueryId === query.id ? 'bg-white/5 border-emerald-500/50' : 'hover:bg-white/5 border-transparent'">
          
          <div i-lucide-bookmark text-yellow="600/80" mt-0.5></div>
          <div flex-1 flex flex-col gap-1>
            <span text-sm font-medium text-gray-200>{{ query.name }}</span>
            <div text-xs flex items-center gap-2>
              <span px-1 pt-0.5 rounded bg-gray-800 text="[10px]" text-gray-400 border border-gray-700>{{ query.connectionName }}</span>
              <span text-gray-600 font-mono text-xs mt-0.5>{{ query.date }}</span>
            </div>
          </div>

          <div opacity-0 group-hover:opacity-100 transition-opacity>
            <Button
              icon="i-lucide-trash"
              variant="secondary"
              class="hover:!text-red-400 hover:!bg-red-500/10 px-2!"
              @click.stop="openDeleteModal(query)"
            />
          </div>
        </div>
      </div>
    </div>
    
    <!-- Editor Preview Pane -->
    <div flex-1 flex flex-col min-w-0>
      <div h-full flex flex-col>
        <!-- Topbar -->
        <div h-12 border-b border-gray-800 flex items-center px-4 gap-2 text-xs text-gray-400 shrink-0>
          <div i-lucide-code-2 text-sm></div>
          <span font-medium text-gray-400>{{ activeQuery?.name || 'Hover a query to preview' }}</span>
        </div>
        
        <!-- Editor Content -->
        <div v-if="activeQuery" bg="[#0d1117]" flex-1 p-6 overflow-y-auto overflow-x-hidden>
          <SqlHighlighter font-mono text-sm leading-6 whitespace-pre-wrap break-words :sql="activeQuery.code" />
        </div>
      
        <div v-else flex-1 flex flex-col items-center justify-center text-gray-600 text-sm>
          <div i-lucide-code-2 text-3xl text-gray-800 mb-4></div>
          <div bg-gray-950>
            Hover a query on the left to preview it here
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Modal :open="isDeleteModalOpen" title="Delete Query" @close="isDeleteModalOpen = false">
      <p text-sm text-gray-400>
        Are you sure you want to delete
        <span font-semibold text-gray-200>{{ queryToDelete?.name }}</span>?
        This action cannot be undone.
      </p>
      <template #footer>
        <Button variant="secondary" @click="isDeleteModalOpen = false">Cancel</Button>
        <Button variant="primary" class="!bg-red-500/10 !text-red-400 hover:!bg-red-500/20" @click="confirmDelete">Delete</Button>
      </template>
    </Modal>
  </div>
</template>
