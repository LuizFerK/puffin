<script setup lang="ts">
import Button from "../Button.vue"
import GroupHeader from "../GroupHeader.vue"
import BackupListItem from "./BackupListItem.vue"
import type { Backup } from "../../types"

defineProps<{
  groups: { id: string; name: string; backups: Backup[] }[]
  total: number
  selectedId: string | null
  isRunning: boolean
}>()

defineEmits<{
  select: [id: string]
  create: []
  openFolder: []
}>()
</script>

<template>
  <div w-80 border-r border-gray-800 flex flex-col shrink-0>
    <!-- Header -->
    <div p-4 py-5 border-b border-gray-800 flex items-center gap-2>
      <div flex-1>
        <h2 text-sm font-semibold text-gray-200>Backups</h2>
        <p text-xs text-gray-500 mt-1.5>{{ total }} {{ total === 1 ? "backup" : "backups" }}</p>
      </div>
      <Button
        icon="i-lucide-folder-open"
        variant="secondary"
        title="Open backups folder"
        class="px-2!"
        @click="$emit('openFolder')"
      />
      <Button
        icon="i-lucide-plus"
        variant="primary"
        :disabled="isRunning"
        @click="$emit('create')"
      >
        New backup
      </Button>
    </div>

    <!-- List Items -->
    <div flex-1 overflow-y-auto bg-gray="900/20">
      <div
        v-if="total === 0"
        flex
        flex-col
        items-center
        justify-center
        gap-3
        mt-16
        text-gray-600
      >
        <div i-lucide-database-backup text-4xl></div>
        <p text-sm>No backups yet</p>
        <p text-xs text-gray-700>Click "New backup" to back up a connection</p>
      </div>

      <div v-for="group in groups" :key="group.id">
        <GroupHeader :name="group.name" :count="group.backups.length" gap-3 px-4 pt-4 pb-2 />

        <BackupListItem
          v-for="backup in group.backups"
          :key="backup.id"
          :backup="backup"
          :is-active="selectedId === backup.id"
          @select="$emit('select', backup.id)"
        />
      </div>
    </div>
  </div>
</template>
