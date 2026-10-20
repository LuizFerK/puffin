<script setup lang="ts">
import SelectableCard from "./SelectableCard.vue"
import { useConnectionStore } from "../../stores/connectionStore"
import { connectionLabel } from "../../helpers/connectionHelpers"
import type { Connection } from "../../types"

defineProps<{
  connections: Connection[]
  // Marks the backup's source so restoring over it stands out
  sourceId?: string
}>()

const model = defineModel<string | null>({ required: true })

const { colorOf } = useConnectionStore()
</script>

<template>
  <div flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1>
    <p v-if="connections.length === 0" text-xs text-gray-600 py-2>
      No connections configured yet.
    </p>
    <SelectableCard
      v-for="conn in connections"
      :key="conn.id"
      :selected="model === conn.id"
      items-center
      @click="model = conn.id"
    >
      <div
        w-8
        h-8
        rounded-lg
        flex
        items-center
        justify-center
        shrink-0
        :style="{ color: colorOf(conn), backgroundColor: colorOf(conn) + '1a' }"
      >
        <div i-lucide-server></div>
      </div>
      <div flex flex-col gap-0.5 min-w-0 flex-1>
        <span text-sm text-gray-200 truncate>{{ connectionLabel(conn) }}</span>
        <span text-xs text-gray-500 font-mono truncate>
          {{ conn.host }}:{{ conn.port }}/{{ conn.database }}
        </span>
      </div>
      <span
        v-if="conn.id === sourceId"
        shrink-0
        px-1.5
        pt-0.5
        rounded
        text="[10px]"
        bg-amber-500="/10"
        text-amber-400
        border
        border-amber-500="/30"
        >source</span
      >
    </SelectableCard>
  </div>
</template>
