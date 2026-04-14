<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import Button from "../components/Button.vue";
import Modal from "../components/Modal.vue";
import HistoryList from "../components/history/HistoryList.vue";
import HistoryPreview from "../components/history/HistoryPreview.vue";
import { useQueryStore } from "../stores/queryStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { HistoryQuery } from "../types";

const {
  historyQueries,
  loadQueries,
  removeHistoryQuery,
  pruneHistory,
  clearHistory,
  updateConsoleState,
} = useQueryStore();
const { loadSettings } = useSettingsStore();
const router = useRouter();

onMounted(async () => {
  await loadSettings();
  await loadQueries();
  pruneHistory();
});

const activeQueryId = ref<number | null>(null);

async function copyQuery(query: HistoryQuery) {
  await updateConsoleState({ queryText: query.code });
  router.push("/");
}

const activeQuery = computed(() => {
  return historyQueries.value.find((q) => q.id === activeQueryId.value);
});

function onHover(id: number) {
  activeQueryId.value = id;
}

// Delete confirmation
const queryToDelete = ref<HistoryQuery | null>(null);
const isDeleteModalOpen = ref(false);

function openDeleteModal(query: HistoryQuery) {
  queryToDelete.value = query;
  isDeleteModalOpen.value = true;
}

async function confirmDelete() {
  if (queryToDelete.value) {
    await removeHistoryQuery(queryToDelete.value.id);
  }
  isDeleteModalOpen.value = false;
  queryToDelete.value = null;
}

// Clear all confirmation
const isClearModalOpen = ref(false);

async function confirmClear() {
  await clearHistory();
  activeQueryId.value = null;
  isClearModalOpen.value = false;
}
</script>

<template>
  <div w-full h-full flex bg-gray-950 font-sans text-gray-300>
    <!-- Sidebar List -->
    <HistoryList
      :queries="historyQueries"
      :active-query-id="activeQueryId"
      @hover="onHover"
      @delete="openDeleteModal"
      @copy="copyQuery"
      @clear-all="isClearModalOpen = true"
    />

    <!-- Editor Preview Pane -->
    <HistoryPreview :query="activeQuery" />

    <!-- Delete Confirmation Modal -->
    <Modal
      :open="isDeleteModalOpen"
      title="Delete History Entry"
      @close="isDeleteModalOpen = false"
    >
      <p text-sm text-gray-400>
        Are you sure you want to remove this query from history? This action
        cannot be undone.
      </p>
      <template #footer>
        <Button variant="secondary" @click="isDeleteModalOpen = false"
          >Cancel</Button
        >
        <Button
          variant="primary"
          class="!bg-red-500/10 !text-red-400 hover:!bg-red-500/20"
          @click="confirmDelete"
          >Delete</Button
        >
      </template>
    </Modal>

    <!-- Clear All Confirmation Modal -->
    <Modal
      :open="isClearModalOpen"
      title="Clear History"
      @close="isClearModalOpen = false"
    >
      <p text-sm text-gray-400>
        Are you sure you want to clear all
        <span font-semibold text-gray-200
          >{{ historyQueries.length }} queries</span
        >
        from history? This action cannot be undone.
      </p>
      <template #footer>
        <Button variant="secondary" @click="isClearModalOpen = false"
          >Cancel</Button
        >
        <Button
          variant="primary"
          class="!bg-red-500/10 !text-red-400 hover:!bg-red-500/20"
          @click="confirmClear"
          >Clear All</Button
        >
      </template>
    </Modal>
  </div>
</template>
