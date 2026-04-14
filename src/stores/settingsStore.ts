import { ref, readonly, computed } from "vue"
import { load } from "@tauri-apps/plugin-store"

export type HistoryRetention = "1d" | "1w" | "2w" | "1m" | "1y" | "forever"

export const HISTORY_RETENTION_OPTIONS: {
  value: HistoryRetention
  label: string
}[] = [
  { value: "1d", label: "1 day" },
  { value: "1w", label: "1 week" },
  { value: "2w", label: "2 weeks" },
  { value: "1m", label: "1 month" },
  { value: "1y", label: "1 year" },
  { value: "forever", label: "Forever" },
]

export const RETENTION_MS: Record<HistoryRetention, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "2w": 14 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
  forever: Infinity,
}

export interface SyntaxColors {
  keyword: string
  function: string
  string: string
  number: string
  comment: string
  type: string
  punct: string
  ident: string
}

const DEFAULT_SYNTAX_COLORS: SyntaxColors = {
  keyword: "#34d399",
  function: "#60a5fa",
  string: "#ffa348",
  number: "#eab308",
  comment: "#9ca3af",
  type: "#c084fc",
  punct: "#9ca3af",
  ident: "#d1d5db",
}

const DEFAULT_HISTORY_MAX_COUNT = 50
const DEFAULT_HISTORY_RETENTION: HistoryRetention = "forever"

const STORE_FILE = "settings.json"

const syntaxColors = ref<SyntaxColors>({ ...DEFAULT_SYNTAX_COLORS })
const historyMaxCount = ref(DEFAULT_HISTORY_MAX_COUNT)
const historyRetention = ref<HistoryRetention>(DEFAULT_HISTORY_RETENTION)
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
  await s.set("syntaxColors", syntaxColors.value)
  await s.set("historyMaxCount", historyMaxCount.value)
  await s.set("historyRetention", historyRetention.value)
}

async function loadSettings() {
  if (loaded.value) return
  const s = await getStore()

  const raw = await s.get<SyntaxColors>("syntaxColors")
  if (raw) {
    syntaxColors.value = { ...DEFAULT_SYNTAX_COLORS, ...raw }
  }

  const rawMaxCount = await s.get<number>("historyMaxCount")
  if (rawMaxCount != null) {
    historyMaxCount.value = rawMaxCount
  }

  const rawRetention = await s.get<HistoryRetention>("historyRetention")
  if (rawRetention) {
    historyRetention.value = rawRetention
  }

  loaded.value = true
}

async function updateSyntaxColor(token: keyof SyntaxColors, color: string) {
  syntaxColors.value = { ...syntaxColors.value, [token]: color }
  await persist()
}

async function resetSyntaxColors() {
  syntaxColors.value = { ...DEFAULT_SYNTAX_COLORS }
  await persist()
}

async function updateHistoryMaxCount(count: number) {
  historyMaxCount.value = count
  await persist()
}

async function updateHistoryRetention(retention: HistoryRetention) {
  historyRetention.value = retention
  await persist()
}

const isHistoryDefault = computed(
  () =>
    historyMaxCount.value === DEFAULT_HISTORY_MAX_COUNT &&
    historyRetention.value === DEFAULT_HISTORY_RETENTION,
)

async function resetHistorySettings() {
  historyMaxCount.value = DEFAULT_HISTORY_MAX_COUNT
  historyRetention.value = DEFAULT_HISTORY_RETENTION
  await persist()
}

async function resetAllSettings() {
  syntaxColors.value = { ...DEFAULT_SYNTAX_COLORS }
  historyMaxCount.value = DEFAULT_HISTORY_MAX_COUNT
  historyRetention.value = DEFAULT_HISTORY_RETENTION
  await persist()
}

export function useSettingsStore() {
  return {
    syntaxColors,
    defaultSyntaxColors: readonly(ref(DEFAULT_SYNTAX_COLORS)),
    historyMaxCount,
    historyRetention,
    isHistoryDefault,
    loaded,
    loadSettings,
    updateSyntaxColor,
    resetSyntaxColors,
    updateHistoryMaxCount,
    updateHistoryRetention,
    resetHistorySettings,
    resetAllSettings,
  }
}
