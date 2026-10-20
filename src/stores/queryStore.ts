import { ref, shallowRef, computed, watch } from "vue"
import { lazyStore } from "../helpers/storeHelpers"
import { invoke } from "@tauri-apps/api/core"
import { format } from 'sql-formatter'
import type { SavedQuery, HistoryQuery, QueryConsoleState, DatabaseSchema } from "../types"
import { useConnectionStore } from "./connectionStore"
import { toConnectionParams } from "../helpers/connectionHelpers"
import { useSettingsStore, RETENTION_MS } from "./settingsStore"

const STORE_FILE = "queries.json"

const savedQueries = ref<SavedQuery[]>([])
const historyQueries = ref<HistoryQuery[]>([])
const consoleState = ref<QueryConsoleState>({
  queryText: "",
})
const loaded = ref(false)
// Shallow: the schema can hold thousands of tables and is only ever replaced whole
const schemaInfo = shallowRef<DatabaseSchema | null>(null)

const getStore = lazyStore(STORE_FILE)

async function persist() {
  const s = await getStore()
  await s.set("savedQueries", savedQueries.value)
  await s.set("historyQueries", historyQueries.value)
  await s.set("consoleState", consoleState.value)
}

async function fetchSchema() {
  const { activeConnection } = useConnectionStore()
  const conn = activeConnection.value
  if (!conn) {
    schemaInfo.value = null
    return
  }
  try {
    schemaInfo.value = await invoke<DatabaseSchema>("fetch_schema", { connection: toConnectionParams(conn) })
  } catch (e) {
    console.error("Failed to fetch schema", e)
    schemaInfo.value = null
  }
}

// Watch active connection to fetch schema when it changes
watch(
  () => useConnectionStore().activeConnection.value,
  () => fetchSchema(),
  { immediate: true },
)

// --- Public API ---

const nextId = computed(() => {
  const maxId = savedQueries.value.reduce((max, q) => Math.max(max, q.id), 0)
  return maxId + 1
})

async function loadQueries() {
  if (loaded.value) return
  const s = await getStore()

  const rawQueries = await s.get<SavedQuery[]>("savedQueries")
  if (rawQueries) {
    savedQueries.value = rawQueries
  }

  const rawHistory = await s.get<HistoryQuery[]>("historyQueries")
  if (rawHistory) {
    historyQueries.value = rawHistory
  }

  const rawConsole = await s.get<QueryConsoleState>("consoleState")
  if (rawConsole) {
    consoleState.value = rawConsole
  }

  loaded.value = true
}

async function addQuery(query: Omit<SavedQuery, "id">) {
  savedQueries.value.push({ id: nextId.value, ...query })
  await persist()
}

async function removeQuery(id: number) {
  savedQueries.value = savedQueries.value.filter((q) => q.id !== id)
  await persist()
}

const nextHistoryId = computed(() => {
  const maxId = historyQueries.value.reduce((max, q) => Math.max(max, q.id), 0)
  return maxId + 1
})

function pruneHistory() {
  const { historyMaxCount, historyRetention } = useSettingsStore()
  const maxCount = historyMaxCount.value
  const retentionMs = RETENTION_MS[historyRetention.value]

  let pruned = historyQueries.value

  // Prune by retention period
  if (retentionMs !== Infinity) {
    const cutoff = Date.now() - retentionMs
    pruned = pruned.filter((q) => q.timestamp >= cutoff)
  }

  // Prune by count
  if (pruned.length > maxCount) {
    pruned = pruned.slice(0, maxCount)
  }

  historyQueries.value = pruned
}

async function addHistoryQuery(query: Omit<HistoryQuery, "id">) {
  historyQueries.value.unshift({ id: nextHistoryId.value, ...query })
  pruneHistory()
  await persist()
}

async function removeHistoryQuery(id: number) {
  historyQueries.value = historyQueries.value.filter((q) => q.id !== id)
  await persist()
}

async function clearHistory() {
  historyQueries.value = []
  await persist()
}

async function updateConsoleState(state: Partial<QueryConsoleState>) {
  consoleState.value = { ...consoleState.value, ...state }
  await persist()
}

async function formatQuery(queryText: string) {
  const fomattedQuery = format(queryText, {
    language: 'postgresql',
    keywordCase: 'upper',
    dataTypeCase: 'upper',
    logicalOperatorNewline: 'after'
  })

  return fomattedQuery
}

export function useQueryStore() {
  return {
    savedQueries,
    historyQueries,
    consoleState,
    loaded,
    schemaInfo,
    loadQueries,
    addQuery,
    removeQuery,
    addHistoryQuery,
    removeHistoryQuery,
    pruneHistory,
    clearHistory,
    updateConsoleState,
    formatQuery,
    fetchSchema,
  }
}
