<script setup lang="ts">
import { computed, inject, shallowRef } from "vue"
import type { CellValue, ResultColumn } from "../../types"
import { editorText, formatCellValue, parseCellKey } from "../../helpers/cellHelpers"
import { RESULT_EDITS_KEY } from "../../composables/useResultEdits"
import ContextMenu, { type ContextMenuItem } from "../ContextMenu.vue"
import ResultsCellEditor from "./ResultsCellEditor.vue"

const props = defineProps<{
  columnMeta: ResultColumn[]
  rows: CellValue[][]
}>()

const emit = defineEmits<{
  "copy-cell": [e: MouseEvent, value: unknown]
}>()

const { pending, editing, readOnlyReasons, startEdit, cancelEdit, commit, setNull, revert } =
  inject(RESULT_EDITS_KEY)!

const menu = shallowRef<{ event: MouseEvent; row: number; col: number } | null>(null)

// Pending edits indexed by row, so v-memo only re-renders the rows they touch
const pendingByRow = computed(() => {
  const byRow = new Map<number, Map<number, string | null>>()
  for (const [key, value] of pending.value) {
    const [row, col] = parseCellKey(key)
    if (!byRow.has(row)) byRow.set(row, new Map())
    byRow.get(row)!.set(col, value)
  }
  return byRow
})

const editingCol = (row: number) => (editing.value?.row === row ? editing.value.col : -1)
const isModified = (row: number, col: number) => pendingByRow.value.get(row)?.has(col) ?? false

function displayedValue(row: number, col: number): CellValue {
  return isModified(row, col) ? pendingByRow.value.get(row)!.get(col)! : props.rows[row][col]
}

function cellClass(row: number, col: number) {
  const isNull = displayedValue(row, col) === null
  if (!isModified(row, col)) return isNull ? "text-gray-600 italic" : "text-gray-300"
  return isNull ? "bg-amber-500/10 text-amber-300/60 italic" : "bg-amber-500/10 text-amber-300"
}

function initialEditorText(row: number, col: number) {
  if (isModified(row, col)) return pendingByRow.value.get(row)!.get(col) ?? ""
  return editorText(props.rows[row][col], props.columnMeta[col].type_name)
}

const menuItems = computed<ContextMenuItem[]>(() => {
  const target = menu.value
  if (!target) return []
  const { event, row, col } = target
  const readOnly = readOnlyReasons.value[col] ?? null
  const nullable = !props.columnMeta[col].source?.not_null
  const value = displayedValue(row, col)

  const items: ContextMenuItem[] = [
    {
      label: "Copy",
      icon: "i-lucide-copy",
      action: () => emit("copy-cell", event, value),
    },
    {
      label: readOnly ?? "Edit",
      icon: readOnly ? "i-lucide-lock" : "i-lucide-pencil",
      disabled: readOnly !== null,
      action: () => startEdit(row, col),
    },
  ]

  if (readOnly === null && nullable && value !== null) {
    items.push({
      label: "Set NULL",
      icon: "i-lucide-circle-slash",
      action: () => setNull(row, col),
    })
  }

  if (isModified(row, col)) {
    items.push({
      label: "Revert",
      icon: "i-lucide-undo-2",
      action: () => revert(row, col),
    })
  }

  return items
})

function openMenu(event: MouseEvent, row: number, col: number) {
  if (editingCol(row) === col) return
  menu.value = { event, row, col }
}
</script>

<template>
  <div flex-1 overflow-auto>
    <table text-left text-xs font-mono border-collapse>
      <thead>
        <tr
          text-gray-500
          border-b
          border-b-gray="800/60"
          border-r
          border-r-gray="800/40"
        >
          <th font-medium uppercase py-3 px-4 w-12>#</th>
          <th
            v-for="col in columnMeta"
            :key="col.name"
            font-medium
            py-3
            px-4
            border-l
            border-gray="800/10"
          >
            {{ col.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in rows"
          :key="i"
          v-memo="[row, editingCol(i), pendingByRow.get(i)]"
          border-b
          border-r
          border-gray="800/40"
          hover:bg-gray="800/20"
          transition-colors
        >
          <td py-2.5 px-4 text-gray-500>{{ i + 1 }}</td>
          <template v-for="(_, j) in row" :key="j">
            <td
              v-if="editingCol(i) === j"
              p-0
              min-w-40
              max-w-xs
              border-l
              border-gray="800/10"
            >
              <ResultsCellEditor
                :initial-text="initialEditorText(i, j)"
                :type-name="columnMeta[j].type_name"
                @commit="(text) => commit(i, j, text)"
                @cancel="cancelEdit(i, j)"
              />
            </td>
            <td
              v-else
              py-2.5
              px-4
              max-w-xs
              truncate
              whitespace-nowrap
              overflow-hidden
              border-l
              border-gray="800/10"
              hover:bg-gray="800/20"
              :class="cellClass(i, j)"
              @contextmenu.prevent="openMenu($event, i, j)"
            >
              {{ formatCellValue(displayedValue(i, j)) }}
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <ContextMenu
      v-if="menu"
      :key="menu.event.timeStamp"
      :x="menu.event.clientX"
      :y="menu.event.clientY"
      :items="menuItems"
      @close="menu = null"
    />
  </div>
</template>
