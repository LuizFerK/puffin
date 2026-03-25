<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import Button from "../components/Button.vue";
import Modal from "../components/Modal.vue";
import QueryList from "../components/collection/QueryList.vue";
import QueryPreview from "../components/collection/QueryPreview.vue";
import { useQueryStore } from "../stores/queryStore";
import type { SavedQuery } from "../stores/types";

const { savedQueries, loadQueries, removeQuery } = useQueryStore();

onMounted(() => loadQueries());

const activeQueryId = ref<number | null>(null);

const activeQuery = computed(() => {
  return savedQueries.value.find((q) => q.id === activeQueryId.value);
});

function onHover(id: number) {
  activeQueryId.value = id;
}

// Delete confirmation
const queryToDelete = ref<SavedQuery | null>(null);
const isDeleteModalOpen = ref(false);

function openDeleteModal(query: SavedQuery) {
  queryToDelete.value = query;
  isDeleteModalOpen.value = true;
}

async function confirmDelete() {
  if (queryToDelete.value) {
    await removeQuery(queryToDelete.value.id);
  }
  isDeleteModalOpen.value = false;
  queryToDelete.value = null;
}
</script>

<template>
  <div w-full h-full flex bg-gray-950 font-sans text-gray-300>
    <!-- Sidebar List -->
    <QueryList
      :queries="savedQueries"
      :active-query-id="activeQueryId"
      @hover="onHover"
      @delete="openDeleteModal"
    />

    <!-- Editor Preview Pane -->
    <QueryPreview :query="activeQuery" />

    <!-- Delete Confirmation Modal -->
    <Modal
      :open="isDeleteModalOpen"
      title="Delete Query"
      @close="isDeleteModalOpen = false"
    >
      <p text-sm text-gray-400>
        Are you sure you want to delete
        <span font-semibold text-gray-200>{{ queryToDelete?.name }}</span
        >? This action cannot be undone.
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
  </div>
</template>
