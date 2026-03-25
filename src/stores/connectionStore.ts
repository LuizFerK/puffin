import { ref, computed } from "vue";
import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import type { Connection } from "./types";

const STORE_FILE = "connections.json";

const connections = ref<Connection[]>([]);
const activeConnectionId = ref<string | null>(null);
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

  // Encrypt passwords before saving
  const toSave = await Promise.all(
    connections.value.map(async (conn) => {
      if (conn.password) {
        const encrypted: string = await invoke("encrypt_password", {
          plaintext: conn.password,
        });
        return { ...conn, password: encrypted };
      }
      return { ...conn };
    }),
  );

  await s.set("connections", toSave);
  await s.set("activeConnectionId", activeConnectionId.value);
}

// --- Public API ---

const activeConnection = computed(
  () =>
    connections.value.find((c) => c.id === activeConnectionId.value) ?? null,
);

const groupedConnections = computed(() => {
  const groups: Record<string, Connection[]> = {};

  connections.value.forEach((conn) => {
    const groupName =
      conn.group && conn.group.trim() !== "" ? conn.group : "Ungrouped";
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(conn);
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Ungrouped") return 1;
    if (b === "Ungrouped") return -1;
    return a.localeCompare(b);
  });

  const sorted: Record<string, Connection[]> = {};
  sortedKeys.forEach((k) => (sorted[k] = groups[k]));
  return sorted;
});

async function loadConnections() {
  if (loaded.value) return;
  const s = await getStore();

  const raw = await s.get<Connection[]>("connections");
  if (raw) {
    // Decrypt passwords after loading
    connections.value = await Promise.all(
      raw.map(async (conn) => {
        if (conn.password) {
          try {
            const decrypted: string = await invoke("decrypt_password", {
              encrypted: conn.password,
            });
            return { ...conn, password: decrypted };
          } catch {
            // If decryption fails, leave password empty
            return { ...conn, password: "" };
          }
        }
        return conn;
      }),
    );
  }

  activeConnectionId.value =
    (await s.get<string>("activeConnectionId")) ?? null;
  loaded.value = true;
}

async function addConnection(data: Omit<Connection, "id">) {
  const conn: Connection = {
    id: Date.now().toString(),
    ...data,
    port: Number(data.port),
  };
  connections.value.push(conn);
  await persist();
}

async function removeConnection(id: string) {
  connections.value = connections.value.filter((c) => c.id !== id);
  if (activeConnectionId.value === id) {
    activeConnectionId.value = connections.value[0]?.id ?? null;
  }
  await persist();
}

async function setActiveConnection(id: string | null) {
  activeConnectionId.value = id;
  const s = await getStore();
  await s.set("activeConnectionId", id);
}

export function useConnectionStore() {
  return {
    connections,
    activeConnectionId,
    activeConnection,
    groupedConnections,
    loaded,
    loadConnections,
    addConnection,
    removeConnection,
    setActiveConnection,
  };
}
