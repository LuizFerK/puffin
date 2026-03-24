<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import SqlHighlighter from '../components/SqlHighlighter.vue'
import Button from '../components/Button.vue'
import Modal from '../components/Modal.vue'
import { useQueryStore } from '../stores/queryStore'
import { useConnectionStore } from '../stores/connectionStore'

const { consoleState, loadQueries, addQuery, updateConsoleState } = useQueryStore()
const { activeConnection, loadConnections } = useConnectionStore()

onMounted(async () => {
  await loadConnections()
  await loadQueries()
  // Hydrate local refs from persisted console state
  queryText.value = consoleState.value.queryText || 'SELECT * FROM users\nORDER BY created_at DESC\nLIMIT 25;'
  editorHeight.value = consoleState.value.editorHeight || 300
})

const editorHeight = ref(300)
const isDragging = ref(false)
const queryText = ref('')

// Debounced persist of console state
let saveTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    updateConsoleState({
      queryText: queryText.value,
      editorHeight: editorHeight.value,
    })
  }, 500)
}

watch(queryText, debouncedSave)
watch(editorHeight, debouncedSave)

const startDrag = () => {
  isDragging.value = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'row-resize'
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  const newHeight = e.clientY - 48
  if (newHeight > 100 && newHeight < window.innerHeight - 150) {
    editorHeight.value = newHeight
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

// Save to collection
const isSaveDialogOpen = ref(false)
const saveName = ref('')

async function saveToCollection() {
  if (!saveName.value.trim()) return
  await addQuery({
    name: saveName.value.trim(),
    connectionName: activeConnection.value?.name ?? 'No connection',
    date: new Date().toISOString().split('T')[0],
    code: queryText.value,
  })
  saveName.value = ''
  isSaveDialogOpen.value = false
}

const lineNumbersArea = ref<HTMLElement | null>(null)
const highlighterArea = ref<HTMLElement | null>(null)

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (lineNumbersArea.value) {
    lineNumbersArea.value.scrollTop = target.scrollTop
  }
  if (highlighterArea.value) {
    highlighterArea.value.scrollTop = target.scrollTop
    highlighterArea.value.scrollLeft = target.scrollLeft
  }
}

const results = [
  { id: 1, name: 'Elena Vasquez', email: 'elena@corp.io', role: 'admin', created_at: '2026-01-14 09:22:01', status: 'active' },
  { id: 2, name: 'Marcus Chen', email: 'mchen@corp.io', role: 'editor', created_at: '2026-01-28 14:05:33', status: 'active' },
  { id: 3, name: 'Priya Sharma', email: 'psharma@corp.io', role: 'viewer', created_at: '2026-02-03 11:41:18', status: 'inactive' },
  { id: 4, name: 'James Okafor', email: 'jokafor@corp.io', role: 'editor', created_at: '2026-02-10 16:30:00', status: 'active' },
  { id: 5, name: 'Yuki Tanaka', email: 'ytanaka@corp.io', role: 'admin', created_at: '2026-02-22 08:15:47', status: 'active' },
  { id: 6, name: 'Sara Lindqvist', email: 'slind@corp.io', role: 'viewer', created_at: '2026-03-01 12:00:22', status: 'pending' },
  { id: 7, name: 'Diego Morales', email: 'dmorales@corp.io', role: 'editor', created_at: '2026-03-05 19:44:10', status: 'active' },
]

const lines = ref(Array.from({ length: 50 }, (_, i) => i + 1))
</script>

<template>
  <div w-full h-full flex flex-col bg-gray-950 font-sans text-gray-300 relative>
    <!-- Topbar -->
    <div h-12 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 bg-gray-950>
      <div flex items-center gap-3>
        <Button icon="i-lucide-play" variant="primary">Execute</Button>
        <span text-xs text-gray-600>Ctrl + Enter</span>
      </div>
      <div flex items-center text-gray-400>
        <Button icon="i-lucide-save" variant="secondary" @click="isSaveDialogOpen = !isSaveDialogOpen" />
      </div>
    </div>

    <!-- Save Dialog -->
    <Modal :open="isSaveDialogOpen" title="Save to Collection" @close="isSaveDialogOpen = false">
      <div flex flex-col gap-3>
        <label text-sm text-gray-400 font-medium>Query Name</label>
        <input
          v-model="saveName"
          type="text"
          placeholder="e.g. All users"
          bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200
          focus:outline-none focus:border-blue-500 transition
          @keyup.enter="saveToCollection"
        />
      </div>
      <template #footer>
        <Button variant="secondary" @click="isSaveDialogOpen = false">Cancel</Button>
        <Button variant="primary" @click="saveToCollection">Save</Button>
      </template>
    </Modal>

    <!-- Editor Wrapper -->
    <div flex :style="{ height: editorHeight + 'px' }" shrink-0 bg="[#0d1117]" overflow-hidden>
      <!-- Line Numbers -->
      <div ref="lineNumbersArea" w-10 py-4 text-right pr-3 font-mono text-xs text-gray-700 select-none overflow-hidden>
        <div v-for="n in lines" :key="n" leading-6>{{ n }}</div>
      </div>
      <!-- Textarea & Highlighter Container -->
      <div relative flex-1 overflow-hidden>
        <div absolute inset-0 overflow-hidden pointer-events-none ref="highlighterArea">
          <SqlHighlighter
            :sql="queryText"
            font-mono p-4 pl-0 text-sm leading-6 whitespace-pre
          />
        </div>
        <textarea 
          v-model="queryText" 
          @scroll="handleScroll"
          absolute inset-0 w-full h-full bg-transparent
          text-transparent caret-white font-mono p-4 pl-0
          text-sm leading-6 resize-none outline-none
          whitespace-pre overflow-auto
          spellcheck="false"
        ></textarea>
      </div>
    </div>

    <!-- Resizer -->
    <div 
      h-1 bg-gray-800 hover:bg-emerald-500 transition-colors w-full cursor-row-resize z-10
      @mousedown.prevent="startDrag"
    ></div>

    <!-- Results Section -->
    <div flex-1 flex flex-col min-h-0 bg-gray-950>
      <!-- Results Header -->
      <div h-10 border-b border-gray-800 flex items-center px-4 gap-5 text-xs text-gray-400 shrink-0>
        <span font-medium text-gray-300>Results</span>
        <div flex items-center gap-1.5 text-emerald-500 font-medium>
          <div i-lucide-check-circle text-xs></div> Success
        </div>
        <div flex items-center gap-1.5>
          <div i-lucide-align-justify text-xs></div> 7 rows
        </div>
        <div flex items-center gap-1.5>
          <div i-lucide-clock text-xs></div> 697ms
        </div>
      </div>

      <!-- Table Wrapper -->
      <div flex-1 overflow-auto>
        <table w-full text-left text-xs font-mono border-collapse>
          <thead>
            <tr text-gray-500 border-b border-gray="800/60">
              <th font-medium uppercase py-3 px-4 w-12>#</th>
              <th font-medium uppercase py-3 px-4>ID</th>
              <th font-medium uppercase py-3 px-4>NAME</th>
              <th font-medium uppercase py-3 px-4>EMAIL</th>
              <th font-medium uppercase py-3 px-4>ROLE</th>
              <th font-medium uppercase py-3 px-4>CREATED_AT</th>
              <th font-medium uppercase py-3 px-4>STATUS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in results" :key="row.id" border-b border-gray="800/40" hover:bg-gray="800/20" transition-colors>
              <td py-2.5 px-4 text-gray-500>{{ i + 1 }}</td>
              <td py-2.5 px-4 text-gray-400>{{ row.id }}</td>
              <td py-2.5 px-4 text-gray-300>{{ row.name }}</td>
              <td py-2.5 px-4 text-gray-300>{{ row.email }}</td>
              <td py-2.5 px-4 text-gray-400>{{ row.role }}</td>
              <td py-2.5 px-4 text-gray-400>{{ row.created_at }}</td>
              <td py-2.5 px-4 text-gray-400>{{ row.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Status bar -->
    <div h-8 mt-auto border-t border-gray-800 flex items-center justify-between px-4 text-xs text-gray-500 shrink-0>
      <div flex items-center gap-2>
        <template v-if="activeConnection">
          <div w-1.5 h-1.5 rounded-full bg-emerald-500></div>
          Connected to {{ activeConnection.name }}
        </template>
        <template v-else>
          <div w-1.5 h-1.5 rounded-full bg-gray-600></div>
          No active connection
        </template>
      </div>
      <div>PostgreSQL</div>
    </div>

  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
