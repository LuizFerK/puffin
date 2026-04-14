<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue"
import { invoke } from "@tauri-apps/api/core"
import Button from "../components/Button.vue"
import Modal from "../components/Modal.vue"
import QueryEditor from "../components/console/QueryEditor.vue"
import ResultsPanel from "../components/console/ResultsPanel.vue"
import { useQueryStore } from "../stores/queryStore"
import { useConnectionStore } from "../stores/connectionStore"
import type { ComponentPublicInstance } from "vue"
import type { QueryResult, PgError } from "../types"

const {
  consoleState,
  loadQueries,
  addQuery,
  addHistoryQuery,
  updateConsoleState,
} = useQueryStore()
const { activeConnection, loadConnections } = useConnectionStore()

onMounted(async () => {
  await loadConnections()
  await loadQueries()
  queryText.value = consoleState.value.queryText || ""
  editorHeight.value = Math.round((window.innerHeight - 60) / 2)
  window.addEventListener("resize", onResize)
})

onUnmounted(() => {
  window.removeEventListener("resize", onResize)
})

function onResize() {
  editorHeight.value = Math.round((window.innerHeight - 60) / 2)
}

const editorHeight = ref(300)
const isDragging = ref(false)
const queryText = ref("")
const editorRef = ref<ComponentPublicInstance<{
  getQueryAtCursor: () => string | null
}> | null>(null)

function executeFromButton() {
  const query = editorRef.value?.getQueryAtCursor?.()
  executeQuery(query ?? undefined)
}

const results = ref<QueryResult | null>(null)
const queryError = ref<PgError | null>(null)
const isExecuting = ref(false)

async function executeQuery(sql?: string) {
  const queryToRun = sql || queryText.value.trim()
  if (!queryToRun) return
  if (!activeConnection.value) {
    queryError.value = {
      detail: "No active connection. Select a connection first.",
      hint: null,
    }
    results.value = null
    return
  }

  isExecuting.value = true
  queryError.value = null
  results.value = null

  // Record to history
  await addHistoryQuery({
    connectionName: activeConnection.value?.name ?? "No connection",
    timestamp: Date.now(),
    code: queryToRun,
  })

  try {
    const conn = activeConnection.value
    const result = await invoke<QueryResult>("execute_query", {
      connection: {
        host: conn.host,
        port: Number(conn.port),
        database: conn.database,
        username: conn.username,
        password: conn.password || "",
      },
      sql: queryToRun,
    })
    results.value = result
  } catch (e: any) {
    const error = e as PgError
    queryError.value = {
      detail: error.detail,
      hint: error.hint,
    }
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
    })
  }, 500)
}

watch(queryText, debouncedSave)
watch(editorHeight, debouncedSave)

const startDrag = () => {
  isDragging.value = true
  document.addEventListener("mousemove", onDrag)
  document.addEventListener("mouseup", stopDrag)
  document.body.style.userSelect = "none"
  document.body.style.cursor = "row-resize"
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
  document.removeEventListener("mousemove", onDrag)
  document.removeEventListener("mouseup", stopDrag)
  document.body.style.userSelect = ""
  document.body.style.cursor = ""
}

// Save to collection
const isSaveDialogOpen = ref(false)
const saveName = ref("")

async function saveToCollection() {
  if (!saveName.value.trim()) return
  await addQuery({
    name: saveName.value.trim(),
    connectionName: activeConnection.value?.name ?? "No connection",
    date: new Date().toISOString().split("T")[0],
    code: queryText.value,
  })
  saveName.value = ""
  isSaveDialogOpen.value = false
}

// Copy cell to clipboard
const copyTooltip = ref({ visible: false, x: 0, y: 0 })
let copyTimer: ReturnType<typeof setTimeout> | null = null

function copyCell(e: MouseEvent, value: unknown) {
  const text = value === null ? "NULL" : String(value)
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
    <div
      h-12
      border-b
      border-gray-800
      flex
      items-center
      justify-between
      px-4
      shrink-0
      bg-gray-950
    >
      <div flex items-center gap-3>
        <Button
          icon="i-lucide-play"
          variant="primary"
          @click="executeFromButton"
          :class="{ 'opacity-50 pointer-events-none': isExecuting }"
        >
          {{ isExecuting ? "Running..." : "Execute" }}
        </Button>
        <span text-xs text-gray-600>Ctrl + Enter</span>
      </div>
      <div flex items-center text-gray-400>
        <Button
          icon="i-lucide-bookmark"
          variant="secondary"
          @click="isSaveDialogOpen = !isSaveDialogOpen"
        />
      </div>
    </div>

    <!-- Save Dialog -->
    <Modal
      :open="isSaveDialogOpen"
      title="Save to Collection"
      @close="isSaveDialogOpen = false"
    >
      <div flex flex-col gap-3>
        <label text-sm text-gray-400 font-medium>Query Name</label>
        <input
          v-model="saveName"
          type="text"
          placeholder="e.g. All users"
          bg-transparent
          border
          border-gray-800
          rounded-lg
          px-3
          py-2
          text-sm
          text-gray-200
          focus:outline-none
          focus:border-emerald-700
          transition
          @keyup.enter="saveToCollection"
        />
      </div>
      <template #footer>
        <Button variant="secondary" @click="isSaveDialogOpen = false"
          >Cancel</Button
        >
        <Button variant="primary" @click="saveToCollection">Save</Button>
      </template>
    </Modal>

    <!-- Editor Wrapper -->
    <QueryEditor
      ref="editorRef"
      v-model="queryText"
      :height="editorHeight"
      @execute="(q: string) => executeQuery(q)"
    />

    <!-- Resizer -->
    <div
      h-1
      bg-gray-800
      hover:bg-emerald-500
      transition-colors
      w-full
      cursor-row-resize
      z-10
      @mousedown.prevent="startDrag"
    ></div>

    <!-- Results Section -->
    <ResultsPanel
      :results="results"
      :error="queryError"
      :is-executing="isExecuting"
      @copy-cell="copyCell"
    />

    <!-- Copy tooltip -->
    <Transition name="fade">
      <div
        v-if="copyTooltip.visible"
        fixed
        z-50
        px-2
        py-1
        rounded
        bg-gray-800
        text-emerald-400
        text-xs
        font-medium
        pointer-events-none
        shadow-lg
        :style="{
          left: copyTooltip.x + 'px',
          top: copyTooltip.y + 'px',
          transform: 'translate(-50%, -100%)',
        }"
      >
        Copied!
      </div>
    </Transition>

    <!-- Status bar -->
    <div
      h-8
      mt-auto
      border-t
      border-gray-800
      flex
      items-center
      justify-between
      px-4
      text-xs
      text-gray-500
      shrink-0
    >
      <div flex items-center gap-2>
        <template v-if="activeConnection">
          <div w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse></div>
          Connected to {{ activeConnection.group }} {{ activeConnection.name }}
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
