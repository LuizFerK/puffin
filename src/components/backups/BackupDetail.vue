<script setup lang="ts">
import { computed } from "vue"
import Button from "../Button.vue"
import { formatDateTime } from "../../helpers/dateHelpers"
import { formatBytes, formatDuration } from "../../helpers/backupHelpers"
import type { Backup } from "../../types"

const props = defineProps<{
  backup: Backup
  isRunning: boolean
}>()

defineEmits<{
  restore: []
  delete: []
  reveal: []
}>()

const facts = computed(() => [
  { label: "Created", value: formatDateTime(props.backup.createdAt) },
  { label: "Size", value: formatBytes(props.backup.sizeBytes) },
  { label: "Took", value: formatDuration(props.backup.durationMs) },
])
</script>

<template>
  <div flex flex-col gap-5 border border-gray-800 rounded-xl p-5 shrink-0>
    <div flex items-start gap-4>
      <div
        w-10
        h-10
        rounded-lg
        bg-blue-500="/10"
        flex
        items-center
        justify-center
        shrink-0
      >
        <div i-lucide-file-archive text-blue-400 text-lg></div>
      </div>
      <div flex-1 min-w-0 flex flex-col gap-1>
        <span text-base font-semibold text-gray-200 truncate>{{ backup.connectionName }}</span>
        <span text-xs font-mono text-gray-500 truncate>
          {{ backup.host }}:{{ backup.port }}/{{ backup.database }}
        </span>
      </div>
    </div>

    <dl grid grid-cols-3 gap-4 m-0 text-xs>
      <div v-for="fact in facts" :key="fact.label" flex flex-col gap-1>
        <dt text-gray-500>{{ fact.label }}</dt>
        <dd m-0 text-gray-200 font-mono>{{ fact.value }}</dd>
      </div>
    </dl>

    <div flex items-center gap-2>
      <Button
        variant="primary"
        icon="i-lucide-archive-restore"
        :disabled="isRunning"
        @click="$emit('restore')"
      >
        Restore...
      </Button>
      <Button variant="secondary" icon="i-lucide-folder-open" @click="$emit('reveal')">
        Show file
      </Button>
      <div flex-1></div>
      <Button
        variant="ghost-danger"
        icon="i-lucide-trash"
        :disabled="isRunning"
        @click="$emit('delete')"
      >
        Delete
      </Button>
    </div>
  </div>
</template>
