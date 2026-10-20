<script setup lang="ts">
import { computed, inject, ref } from "vue"
import { RESULT_EDITS_KEY } from "../../composables/useResultEdits"
import PgErrorMessage from "./PgErrorMessage.vue"
import SqlHighlighter from "../SqlHighlighter.vue"
import Button from "../Button.vue"
import Modal from "../Modal.vue"

const { pending, rowUpdates, isApplying, applyError, apply, discardAll, previewSql } =
  inject(RESULT_EDITS_KEY)!

const showConfirm = ref(false)
const showPreview = ref(false)
const preview = ref<string | null>(null)
const previewError = ref<string | null>(null)

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

const label = computed(() => plural(pending.value.size, "pending change"))

const rowCount = computed(() => rowUpdates.value.updates.length)

const tableNames = computed(() => [
  ...new Set(rowUpdates.value.updates.map((u) => `${u.schema}.${u.table}`)),
])

// Mirrors apply_cell_edits: every UPDATE runs inside one transaction
const toScript = (statements: string[]) =>
  ["BEGIN;", ...statements.map((s) => `${s};`), "COMMIT;"].join("\n\n")

function openConfirm() {
  showPreview.value = false
  preview.value = null
  previewError.value = null
  showConfirm.value = true
}

async function togglePreview() {
  showPreview.value = !showPreview.value
  if (!showPreview.value || preview.value !== null) return

  try {
    preview.value = toScript(await previewSql())
  } catch (e) {
    previewError.value = String(e)
  }
}

function confirmApply() {
  showConfirm.value = false
  apply()
}
</script>

<template>
  <template v-if="pending.size > 0">
    <span text-amber-400>{{ label }}</span>

    <button
      class="header-action"
      text-gray-500
      hover:text-gray-300
      title="Discard changes"
      :disabled="isApplying"
      @click="discardAll"
    >
      <div i-lucide-undo-2 text-xs></div>
      Discard
    </button>

    <button
      class="header-action"
      text-emerald-500
      hover:text-emerald-400
      font-medium
      title="Apply changes"
      :disabled="isApplying"
      @click="openConfirm"
    >
      <div v-if="isApplying" i-lucide-loader-2 text-xs class="animate-spin"></div>
      <div v-else i-lucide-check text-xs></div>
      Apply
    </button>
  </template>

  <Modal
    :open="showConfirm"
    :wide="showPreview"
    title="Apply changes"
    @close="showConfirm = false"
  >
    <div flex flex-col gap-4 text-sm text-gray-400>
      <p>
        This will update
        <span text-amber-400 font-semibold>{{ plural(rowCount, "row") }}</span>
        ({{ plural(pending.size, "cell") }}) in
        <span font-mono text-gray-300>{{ tableNames.join(", ") }}</span>.
      </p>
      <p text-xs text-gray-500>
        All updates run in a single transaction. If any row no longer matches, nothing is
        written.
      </p>

      <div
        v-if="showPreview"
        bg="[#0d1117]"
        border
        border-gray-800
        rounded-lg
        p-4
        max-h-80
        overflow-y-auto
      >
        <span v-if="previewError" text-red-400 text-xs>{{ previewError }}</span>
        <SqlHighlighter
          v-else-if="preview"
          font-mono
          text-xs
          leading-5
          whitespace-pre-wrap
          break-all
          :sql="preview"
        />
        <div v-else flex items-center gap-2 text-xs text-gray-500>
          <div i-lucide-loader-2 class="animate-spin"></div>
          Building preview...
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        variant="secondary"
        :icon="showPreview ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        @click="togglePreview"
      >
        {{ showPreview ? "Hide SQL" : "Preview SQL" }}
      </Button>
      <div flex-1></div>
      <Button variant="secondary" @click="showConfirm = false">Cancel</Button>
      <Button variant="primary" icon="i-lucide-check" @click="confirmApply">
        Update {{ plural(rowCount, "row") }}
      </Button>
    </template>
  </Modal>

  <Modal
    :open="applyError !== null"
    title="Failed to apply changes"
    @close="applyError = null"
  >
    <div v-if="applyError" flex flex-col>
      <PgErrorMessage :error="applyError" />
      <span text-xs text-gray-500 mt-2>
        Nothing was written. Your changes are still pending.
      </span>
    </div>

    <template #footer>
      <Button variant="secondary" @click="applyError = null">Close</Button>
    </template>
  </Modal>
</template>

<style scoped>
.header-action {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  transition: color 0.2s;
}
</style>
