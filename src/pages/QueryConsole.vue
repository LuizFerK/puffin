<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
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
  queryText.value = consoleState.value.queryText || ''
  editorHeight.value = consoleState.value.editorHeight || Math.round((window.innerHeight - 60) / 2)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', onResize)
})

function onResize() {
  editorHeight.value = Math.round((window.innerHeight - 60) / 2)
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    executeQuery()
  }
}

const editorHeight = ref(300)
const isDragging = ref(false)
const queryText = ref('')

// Query execution state
interface QueryResult {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  row_count: number
  elapsed_ms: number
}

const results = ref<QueryResult | null>(null)
const queryError = ref<string | null>(null)
const isExecuting = ref(false)

async function executeQuery() {
  if (!queryText.value.trim()) return
  if (!activeConnection.value) {
    queryError.value = 'No active connection. Select a connection first.'
    results.value = null
    return
  }

  isExecuting.value = true
  queryError.value = null
  results.value = null

  try {
    const conn = activeConnection.value
    const result = await invoke<QueryResult>('execute_query', {
      connection: {
        host: conn.host,
        port: Number(conn.port),
        database: conn.database,
        username: conn.username,
        password: conn.password || '',
      },
      sql: queryText.value,
    })
    results.value = result
  } catch (e) {
    queryError.value = String(e)
    results.value = null
  } finally {
    isExecuting.value = false
  }
}

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

const lines = ref(Array.from({ length: 50 }, (_, i) => i + 1))

// Copy cell to clipboard
const copyTooltip = ref({ visible: false, x: 0, y: 0 })
let copyTimer: ReturnType<typeof setTimeout> | null = null

function copyCell(e: MouseEvent, value: unknown) {
  const text = value === null ? 'NULL' : String(value)
  navigator.clipboard.writeText(text)
  copyTooltip.value = { visible: true, x: e.clientX, y: e.clientY - 10 }
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copyTooltip.value.visible = false
  }, 1500)
}
</script>

<template>
  <div w-full h-full flex flex-col bg-gray-950 font-sans text-gray-300 relative>
    <!-- Topbar -->
    <div h-12 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 bg-gray-950>
      <div flex items-center gap-3>
        <Button icon="i-lucide-play" variant="primary" @click="executeQuery" :class="{ 'opacity-50 pointer-events-none': isExecuting }">
          {{ isExecuting ? 'Running...' : 'Execute' }}
        </Button>
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

        <template v-if="isExecuting">
          <div flex items-center gap-1.5 text-yellow-500 font-medium>
            <div i-lucide-loader-2 text-xs class="animate-spin"></div> Running...
          </div>
        </template>

        <template v-else-if="queryError">
          <div flex items-center gap-1.5 text-red-400 font-medium>
            <div i-lucide-x-circle text-xs></div> Error
          </div>
        </template>

        <template v-else-if="results">
          <div flex items-center gap-1.5 text-emerald-500 font-medium>
            <div i-lucide-check-circle text-xs></div> Success
          </div>
          <div flex items-center gap-1.5>
            <div i-lucide-align-justify text-xs></div> {{ results.row_count }} rows
          </div>
          <div flex items-center gap-1.5>
            <div i-lucide-clock text-xs></div> {{ results.elapsed_ms }}ms
          </div>
        </template>

        <template v-else>
          <span text-gray-600>Run a query to see results</span>
        </template>
      </div>

      <!-- Error Display -->
      <div v-if="queryError" flex-1 p-4 overflow-auto>
        <div bg-red="500/5" border border-red="500/20" rounded-lg p-4 text-sm text-red-400 font-mono whitespace-pre-wrap>
          {{ queryError }}
        </div>
      </div>

      <!-- Table Wrapper -->
      <div v-else-if="results && results.columns.length > 0" flex-1 overflow-auto>
        <table text-left text-xs font-mono border-collapse>
          <thead>
            <tr text-gray-500 border-b border-gray="800/60">
              <th font-medium uppercase py-3 px-4 w-12>#</th>
              <th v-for="col in results.columns" :key="col" font-medium py-3 px-4 border-l border-gray="800/10">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in results.rows" :key="i" border-b border-gray="800/40" hover:bg-gray="800/20" transition-colors>
              <td py-2.5 px-4 text-gray-500>{{ i + 1 }}</td>
              <td v-for="(cell, j) in row" :key="j" py-2.5 px-4 max-w-xs truncate whitespace-nowrap overflow-hidden border-l border-gray="800/10" hover:bg-gray="800/20"
                  cursor-pointer select-none
                  :class="cell === null ? 'text-gray-600 italic' : 'text-gray-300'"
                  @dblclick="copyCell($event, cell)">
                {{ cell === null ? 'NULL' : cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <div v-else-if="results && results.columns.length === 0" flex-1 flex flex-col items-center justify-center text-gray-600>
        <div i-lucide-check-circle text-2xl text-emerald-600 mb-2></div>
        <span text-sm>Query executed successfully</span>
        <span text-xs text-gray-700 mt-1>{{ results.row_count }} rows affected</span>
      </div>

      <!-- No results yet -->
      <div v-else flex-1 flex flex-col items-center justify-center text-gray-600>
        <div i-lucide-terminal text-3xl text-gray-800 mb-3></div>
        <span text-sm>Run a query to see results here</span>
      </div>
    </div>

    <!-- Copy tooltip -->
    <Transition name="fade">
      <div v-if="copyTooltip.visible"
        fixed z-50 px-2 py-1 rounded bg-gray-800 text-emerald-400 text-xs font-medium pointer-events-none shadow-lg
        :style="{ left: copyTooltip.x + 'px', top: copyTooltip.y + 'px', transform: 'translate(-50%, -100%)' }">
        Copied!
      </div>
    </Transition>

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

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
