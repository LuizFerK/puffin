<script setup lang="ts">
import Button from "../Button.vue"
import type { SavedQuery } from "../../types"

defineProps<{
  query: SavedQuery
  isActive: boolean
}>()

defineEmits<{
  hover: []
  delete: []
  copy: []
}>()
</script>

<template>
  <div
    class="group"
    @mouseenter="$emit('hover')"
    p-4
    py-3
    flex
    gap-3
    cursor-default
    transition-colors
    border-l-2
    items-center
    :class="
      isActive
        ? 'bg-white/5 border-emerald-500/50'
        : 'hover:bg-white/5 border-transparent'
    "
  >
    <div i-lucide-bookmark text-yellow="600/80" mt-0.5></div>
    <div flex-1 flex flex-col gap-1>
      <span text-sm font-medium text-gray-200>{{ query.name }}</span>
      <div text-xs flex items-center gap-1>
        <span
          px-1
          pt-0.5
          rounded
          bg-gray-800
          text="[10px]"
          text-gray-400
          border
          border-gray-700
          >{{ query.connectionName }}</span
        >
        <span text-gray-600 font-mono text-xs mt-0.5>{{ query.date }}</span>
      </div>
    </div>

    <div class="hidden! group-hover:flex!" transition-all flex gap-1>
      <Button
        icon="i-lucide-terminal"
        variant="secondary"
        class="hover:!text-green-400 hover:!bg-green-500/10 px-2!"
        @click.stop="$emit('copy')"
      />
      <Button
        icon="i-lucide-trash"
        variant="secondary"
        class="hover:!text-red-400 hover:!bg-red-500/10 px-2!"
        @click.stop="$emit('delete')"
      />
    </div>
  </div>
</template>
