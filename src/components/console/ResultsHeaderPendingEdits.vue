<script setup lang="ts">
import { computed, inject } from "vue"
import { RESULT_EDITS_KEY } from "../../composables/useResultEdits"
import PgErrorMessage from "./PgErrorMessage.vue"
import Button from "../Button.vue"
import Modal from "../Modal.vue"

const { pending, isApplying, applyError, apply, discardAll } = inject(RESULT_EDITS_KEY)!

const label = computed(() =>
  pending.value.size === 1 ? "1 pending change" : `${pending.value.size} pending changes`,
)
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
      @click="apply"
    >
      <div v-if="isApplying" i-lucide-loader-2 text-xs class="animate-spin"></div>
      <div v-else i-lucide-check text-xs></div>
      Apply
    </button>
  </template>

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
