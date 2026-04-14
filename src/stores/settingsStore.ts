import { ref, readonly } from "vue";
import { load } from "@tauri-apps/plugin-store";

export interface SyntaxColors {
  keyword: string;
  function: string;
  string: string;
  number: string;
  comment: string;
  type: string;
  punct: string;
  ident: string;
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
};

const STORE_FILE = "settings.json";

const syntaxColors = ref<SyntaxColors>({ ...DEFAULT_SYNTAX_COLORS });
const loaded = ref(false);

let store: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!store) {
    store = await load(STORE_FILE, { autoSave: true, defaults: {} });
  }
  return store;
}

async function persist() {
  const s = await getStore();
  await s.set("syntaxColors", syntaxColors.value);
}

async function loadSettings() {
  if (loaded.value) return;
  const s = await getStore();

  const raw = await s.get<SyntaxColors>("syntaxColors");
  if (raw) {
    syntaxColors.value = { ...DEFAULT_SYNTAX_COLORS, ...raw };
  }

  loaded.value = true;
}

async function updateSyntaxColor(token: keyof SyntaxColors, color: string) {
  syntaxColors.value = { ...syntaxColors.value, [token]: color };
  await persist();
}

async function resetSyntaxColors() {
  syntaxColors.value = { ...DEFAULT_SYNTAX_COLORS };
  await persist();
}

export function useSettingsStore() {
  return {
    syntaxColors,
    defaultSyntaxColors: readonly(ref(DEFAULT_SYNTAX_COLORS)),
    loaded,
    loadSettings,
    updateSyntaxColor,
    resetSyntaxColors,
  };
}
