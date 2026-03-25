import { ref, computed } from 'vue'
import { load } from '@tauri-apps/plugin-store'
import type { SavedQuery, QueryConsoleState } from './types'

const STORE_FILE = 'queries.json'

const savedQueries = ref<SavedQuery[]>([])
const consoleState = ref<QueryConsoleState>({
  queryText: ''
})
const loaded = ref(false)

let store: Awaited<ReturnType<typeof load>> | null = null

async function getStore() {
  if (!store) {
    store = await load(STORE_FILE, { autoSave: true, defaults: {} })
  }
  return store
}

async function persist() {
  const s = await getStore()
  await s.set('savedQueries', savedQueries.value)
  await s.set('consoleState', consoleState.value)
}

// --- Public API ---

const nextId = computed(() => {
  const maxId = savedQueries.value.reduce((max, q) => Math.max(max, q.id), 0)
  return maxId + 1
})

async function loadQueries() {
  if (loaded.value) return
  const s = await getStore()

  const rawQueries = await s.get<SavedQuery[]>('savedQueries')
  if (rawQueries) {
    savedQueries.value = rawQueries
  }

  const rawConsole = await s.get<QueryConsoleState>('consoleState')
  if (rawConsole) {
    consoleState.value = rawConsole
  }

  loaded.value = true
}

async function addQuery(query: Omit<SavedQuery, 'id'>) {
  savedQueries.value.push({ id: nextId.value, ...query })
  await persist()
}

async function removeQuery(id: number) {
  savedQueries.value = savedQueries.value.filter((q) => q.id !== id)
  await persist()
}

async function updateConsoleState(state: Partial<QueryConsoleState>) {
  consoleState.value = { ...consoleState.value, ...state }
  await persist()
}

export function useQueryStore() {
  return {
    savedQueries,
    consoleState,
    loaded,
    loadQueries,
    addQuery,
    removeQuery,
    updateConsoleState,
  }
}
