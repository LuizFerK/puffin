<script setup lang="ts">
import { ref } from "vue";
import type { QueryResult } from "../../types";
import Button from "../Button.vue";
import Checkbox from "../Checkbox.vue";
import Modal from "../Modal.vue";

const props = defineProps<{
  results: QueryResult;
}>();

const showCopyModal = ref(false);
const removeIndex = ref(false);
const removeColumnNames = ref(false);
const copyFormat = ref<"csv" | "pretty">("pretty");
const copied = ref(false);

function formatPretty(
  columns: string[],
  rows: (string | number | boolean | null)[][],
  includeIndex: boolean,
  includeHeaders: boolean,
): string {
  const allCols: string[] = [];
  if (includeIndex) allCols.push("#");
  allCols.push(...columns);

  const allRows = rows.map((row, i) => {
    const cells: string[] = [];
    if (includeIndex) cells.push(String(i + 1));
    cells.push(...row.map((c) => (c === null ? "NULL" : String(c))));
    return cells;
  });

  const widths = allCols.map((col, i) => {
    const headerLen = includeHeaders ? col.length : 0;
    const maxDataLen = allRows.reduce(
      (max, row) => Math.max(max, (row[i] ?? "").length),
      0,
    );
    return Math.max(headerLen, maxDataLen);
  });

  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
  const separator = widths.map((w) => "-".repeat(w)).join("-+-");
  const formatRow = (cells: string[]) =>
    cells.map((c, i) => pad(c, widths[i])).join(" | ");

  const lines: string[] = [];
  if (includeHeaders) {
    lines.push(formatRow(allCols));
    lines.push(separator);
  }
  for (const row of allRows) {
    lines.push(formatRow(row));
  }
  return "```json\n" + lines.join("\n") + "\n```";
}

function formatCsv(
  columns: string[],
  rows: (string | number | boolean | null)[][],
  includeIndex: boolean,
  includeHeaders: boolean,
): string {
  const escapeCsv = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines: string[] = [];

  if (includeHeaders) {
    const headerCells: string[] = [];
    if (includeIndex) headerCells.push("#");
    headerCells.push(...columns);
    lines.push(headerCells.map(escapeCsv).join(","));
  }

  for (let i = 0; i < rows.length; i++) {
    const cells: string[] = [];
    if (includeIndex) cells.push(String(i + 1));
    cells.push(...rows[i].map((c) => (c === null ? "NULL" : String(c))));
    lines.push(cells.map(escapeCsv).join(","));
  }

  return lines.join("\n");
}

function copyToClipboard() {
  const { columns, rows } = props.results;
  const includeIndex = !removeIndex.value;
  const includeHeaders = !removeColumnNames.value;

  const text =
    copyFormat.value === "csv"
      ? formatCsv(columns, rows, includeIndex, includeHeaders)
      : formatPretty(columns, rows, includeIndex, includeHeaders);

  navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
    showCopyModal.value = false;
  }, 500);
}

function open() {
  copied.value = false;
  showCopyModal.value = true;
}
</script>

<template>
  <!-- Copy button -->
  <button
    flex
    items-center
    gap-1.5
    text-gray-500
    hover:text-gray-300
    transition-colors
    duration-200
    cursor-pointer
    outline-none
    bg-transparent
    border-none
    @click="open"
  >
    <div i-lucide-copy text-xs></div>
  </button>

  <!-- Copy Modal -->
  <Modal
    :open="showCopyModal"
    title="Copy to Clipboard"
    @close="showCopyModal = false"
  >
    <div flex flex-col gap-5>
      <!-- Format selector -->
      <div flex flex-col gap-2>
        <span text-sm text-gray-400 font-medium>Format</span>
        <div flex gap-2>
          <button
            flex-1
            py-2
            rounded-lg
            text-sm
            font-medium
            cursor-pointer
            outline-none
            border
            transition-colors
            duration-200
            :class="
              copyFormat === 'pretty'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-transparent border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
            "
            @click="copyFormat = 'pretty'"
          >
            Pretty
          </button>
          <button
            flex-1
            py-2
            rounded-lg
            text-sm
            font-medium
            cursor-pointer
            outline-none
            border
            transition-colors
            duration-200
            :class="
              copyFormat === 'csv'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-transparent border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
            "
            @click="copyFormat = 'csv'"
          >
            CSV
          </button>
        </div>
      </div>

      <!-- Options -->
      <div flex flex-col gap-3>
        <span text-sm text-gray-400 font-medium>Options</span>
        <Checkbox v-model="removeIndex">Remove index column</Checkbox>
        <Checkbox v-model="removeColumnNames">Remove column names</Checkbox>
      </div>
    </div>

    <template #footer>
      <Button variant="secondary" @click="showCopyModal = false">Cancel</Button>
      <Button variant="primary" @click="copyToClipboard">
        <div v-if="copied" i-lucide-check text-xs></div>
        <div v-else i-lucide-copy text-xs></div>
        {{ copied ? "Copied!" : "Copy" }}
      </Button>
    </template>
  </Modal>
</template>
