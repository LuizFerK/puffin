<script setup lang="ts">
import { computed, ref } from "vue"
import Button from "../Button.vue"
import Modal from "../Modal.vue"
import ConnectionPicker from "./ConnectionPicker.vue"
import SelectableCard from "./SelectableCard.vue"
import type { Connection } from "../../types"

const props = defineProps<{
  open: boolean
  groups: Record<string, Connection[]>
}>()

const emit = defineEmits<{
  close: []
  start: [connection: Connection]
}>()

const groupNames = computed(() => Object.keys(props.groups))

// Remounted on every open by the parent. A single group has nothing to choose from,
// so start straight on its connections.
const selectedGroup = ref<string | null>(
  groupNames.value.length === 1 ? groupNames.value[0] : null,
)
const selectedId = ref<string | null>(null)

const groupConnections = computed(() =>
  selectedGroup.value ? (props.groups[selectedGroup.value] ?? []) : [],
)
const selected = computed(
  () => groupConnections.value.find((c) => c.id === selectedId.value) ?? null,
)

// null goes back to the group list
function openGroup(name: string | null) {
  selectedGroup.value = name
  selectedId.value = null
}

function start() {
  if (selected.value) emit("start", selected.value)
}
</script>

<template>
  <Modal :open="open" title="New backup" @close="emit('close')">
    <div flex flex-col gap-4>
      <p text-sm text-gray-400>
        Pick the connection to back up. Puffin runs
        <code text-xs text-gray-300>pg_dump</code> in custom format and keeps the file in
        its data folder.
      </p>

      <!-- Step 1: groups -->
      <div v-if="selectedGroup === null" flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1>
        <p v-if="groupNames.length === 0" text-xs text-gray-600 py-2>
          No connections configured yet.
        </p>
        <SelectableCard v-for="name in groupNames" :key="name" items-center @click="openGroup(name)">
          <div i-lucide-folder text-gray-500 shrink-0></div>
          <span flex-1 text-sm text-gray-200 truncate>{{ name }}</span>
          <span shrink-0 text-xs text-gray-500>{{ groups[name].length }}</span>
          <div i-lucide-chevron-right text-gray-600 shrink-0></div>
        </SelectableCard>
      </div>

      <!-- Step 2: connections of the chosen group -->
      <div v-else flex flex-col gap-2>
        <button
          v-if="groupNames.length > 1"
          flex
          items-center
          gap-1.5
          self-start
          bg-transparent
          border-none
          p-0
          text-xs
          text-gray-500
          hover:text-gray-300
          cursor-pointer
          outline-none
          transition-colors
          @click="openGroup(null)"
        >
          <div i-lucide-chevron-left></div>
          All groups
          <span text-gray-700>/</span>
          <span text-gray-300 font-medium>{{ selectedGroup }}</span>
        </button>
        <ConnectionPicker v-model="selectedId" :connections="groupConnections" />
      </div>
    </div>

    <template #footer>
      <Button variant="secondary" @click="emit('close')">Cancel</Button>
      <Button
        variant="primary"
        icon="i-lucide-database-backup"
        :disabled="!selected"
        @click="start"
      >
        Start backup
      </Button>
    </template>
  </Modal>
</template>
