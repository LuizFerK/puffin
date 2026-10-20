import { load, type Store } from "@tauri-apps/plugin-store"

// Caches the promise, so concurrent first callers share a single load
export function lazyStore(file: string): () => Promise<Store> {
  let store: Promise<Store> | null = null
  return () => (store ??= load(file, { autoSave: true, defaults: {} }))
}
