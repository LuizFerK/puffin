import { ref, computed, watch } from "vue";
import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import type { SavedQuery, QueryConsoleState } from "./types";
import { useConnectionStore } from "./connectionStore";

export interface SchemaInfo {
  tables: Record<string, string[]>;
}

const STORE_FILE = "queries.json";

const savedQueries = ref<SavedQuery[]>([]);
const consoleState = ref<QueryConsoleState>({
  queryText: "",
});
const loaded = ref(false);
const schemaInfo = ref<Record<string, string[]> | null>(null);

let store: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!store) {
    store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  }
  return store;
}

async function persist() {
  const s = await getStore();
  await s.set("savedQueries", savedQueries.value);
  await s.set("consoleState", consoleState.value);
}

async function fetchSchema() {
  const { activeConnection } = useConnectionStore();
  const conn = activeConnection.value;
  if (!conn) {
    schemaInfo.value = null;
    return;
  }
  try {
    const res: SchemaInfo = await invoke("fetch_schema", { connection: conn });
    schemaInfo.value = res.tables;
  } catch (e) {
    console.error("Failed to fetch schema", e);
    schemaInfo.value = null;
  }
}

// Watch active connection to fetch schema when it changes
watch(
  () => useConnectionStore().activeConnection.value,
  () => fetchSchema(),
  { immediate: true }
);

// --- Public API ---

const nextId = computed(() => {
  const maxId = savedQueries.value.reduce((max, q) => Math.max(max, q.id), 0);
  return maxId + 1;
});

async function loadQueries() {
  if (loaded.value) return;
  const s = await getStore();

  const rawQueries = await s.get<SavedQuery[]>("savedQueries");
  if (rawQueries) {
    savedQueries.value = rawQueries;
  }

  const rawConsole = await s.get<QueryConsoleState>("consoleState");
  if (rawConsole) {
    consoleState.value = rawConsole;
  }

  loaded.value = true;
}

async function addQuery(query: Omit<SavedQuery, "id">) {
  savedQueries.value.push({ id: nextId.value, ...query });
  await persist();
}

async function removeQuery(id: number) {
  savedQueries.value = savedQueries.value.filter((q) => q.id !== id);
  await persist();
}

async function updateConsoleState(state: Partial<QueryConsoleState>) {
  consoleState.value = { ...consoleState.value, ...state };
  await persist();
}

export function useQueryStore() {
  return {
    savedQueries,
    consoleState,
    loaded,
    schemaInfo,
    loadQueries,
    addQuery,
    removeQuery,
    updateConsoleState,
    fetchSchema,
  };
}
