import { computed, ref, shallowRef, watch, type InjectionKey, type Ref } from "vue"
import { invoke } from "@tauri-apps/api/core"
import type { CellValue, PgError, QueryResult } from "../types"
import { useConnectionStore } from "../stores/connectionStore"
import { toConnectionParams } from "../helpers/connectionHelpers"
import {
  buildRowUpdates,
  cellKey,
  editorText,
  type PendingEdits,
} from "../helpers/cellHelpers"

// Copies only the touched rows; untouched rows keep their identity
function patchRows(
  rows: CellValue[][],
  targets: [number, number][][],
  updated: CellValue[][],
): CellValue[][] {
  const next = rows.slice()
  targets.forEach((cells, i) =>
    cells.forEach(([row, col], j) => {
      if (next[row] === rows[row]) next[row] = rows[row].slice()
      next[row][col] = updated[i][j]
    }),
  )
  return next
}

export function useResultEdits(results: Ref<QueryResult | null>) {
  const { activeConnection } = useConnectionStore()

  // Replaced on every change so the Map stays shallow-reactive
  const pending = shallowRef<PendingEdits>(new Map())
  const editing = ref<{ row: number; col: number } | null>(null)
  const isApplying = ref(false)
  const applyError = ref<PgError | null>(null)

  const rowUpdates = computed(() =>
    results.value ? buildRowUpdates(results.value, pending.value) : { updates: [], targets: [] },
  )

  const readOnlyReasons = computed(
    () => results.value?.column_meta.map((c) => c.read_only_reason) ?? [],
  )

  watch(results, () => {
    pending.value = new Map()
    editing.value = null
    applyError.value = null
  })

  function updatePending(mutate: (next: Map<string, string | null>) => void) {
    const next = new Map(pending.value)
    mutate(next)
    pending.value = next
  }

  function isUnchanged(row: number, col: number, text: string | null) {
    const result = results.value!
    const original = result.rows[row][col]
    if (text === null) return original === null
    return text === editorText(original, result.column_meta[col].type_name)
  }

  function startEdit(row: number, col: number) {
    if (readOnlyReasons.value[col] !== null) return
    editing.value = { row, col }
  }

  const isEditing = (row: number, col: number) =>
    editing.value?.row === row && editing.value?.col === col

  function setCell(row: number, col: number, text: string | null) {
    const key = cellKey(row, col)
    updatePending((next) =>
      isUnchanged(row, col, text) ? next.delete(key) : next.set(key, text),
    )
  }

  // No-ops once the edit settled, so the blur fired when the editor unmounts is harmless
  function cancelEdit(row: number, col: number) {
    if (isEditing(row, col)) editing.value = null
  }

  function commit(row: number, col: number, text: string) {
    if (!isEditing(row, col)) return
    editing.value = null
    setCell(row, col, text)
  }

  const setNull = (row: number, col: number) => setCell(row, col, null)

  function revert(row: number, col: number) {
    updatePending((next) => next.delete(cellKey(row, col)))
  }

  function discardAll() {
    pending.value = new Map()
    editing.value = null
  }

  async function apply() {
    const result = results.value
    const conn = activeConnection.value
    if (!result || !conn || pending.value.size === 0 || isApplying.value) return

    const { updates, targets } = rowUpdates.value
    isApplying.value = true

    try {
      const updated = await invoke<CellValue[][]>("apply_cell_edits", {
        connection: toConnectionParams(conn),
        edits: updates,
      })
      // Replacing the result also resets pending edits through the watcher above
      results.value = { ...result, rows: patchRows(result.rows, targets, updated) }
    } catch (e) {
      applyError.value = e as PgError
    } finally {
      isApplying.value = false
    }
  }

  const previewSql = () =>
    invoke<string[]>("preview_cell_edits", { edits: rowUpdates.value.updates })

  return {
    pending,
    rowUpdates,
    editing,
    isApplying,
    applyError,
    readOnlyReasons,
    startEdit,
    cancelEdit,
    commit,
    setNull,
    revert,
    discardAll,
    apply,
    previewSql,
  }
}

export const RESULT_EDITS_KEY: InjectionKey<ReturnType<typeof useResultEdits>> =
  Symbol("resultEdits")
