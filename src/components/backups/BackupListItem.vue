<script setup lang="ts">
import { formatDateTime, timeAgo } from "../../helpers/dateHelpers"
import { formatBytes } from "../../helpers/backupHelpers"
import type { Backup } from "../../types"

defineProps<{
  backup: Backup
  isActive: boolean
}>()

defineEmits<{
  select: []
}>()
</script>

<template>
  <div
    p-4
    py-3
    flex
    gap-3
    items-center
    cursor-pointer
    transition-colors
    border-l-2
    :class="isActive ? 'bg-white/5 border-emerald-500/50' : 'hover:bg-white/5 border-transparent'"
    @click="$emit('select')"
  >
    <div i-lucide-file-archive text-blue="500/70" shrink-0></div>
    <div flex-1 flex flex-col gap-1 min-w-0>
      <span text-sm font-medium text-gray-200 font-mono>{{ formatDateTime(backup.createdAt) }}</span>
      <div text-xs flex items-center gap-1.5 min-w-0 whitespace-nowrap>
        <span
          truncate
          px-1
          pt-0.5
          rounded
          bg-gray-800
          text="[10px]"
          text-gray-400
          border
          border-gray-700
          >{{ backup.database }}</span
        >
        <span shrink-0 text-gray-600 mt-0.5>{{ formatBytes(backup.sizeBytes) }}</span>
        <span shrink-0 text-gray-700 mt-0.5>·</span>
        <span shrink-0 text-gray-600 mt-0.5>{{ timeAgo(backup.createdAt) }}</span>
      </div>
    </div>
  </div>
</template>
