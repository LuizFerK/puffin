<script setup lang="ts">
import Button from "../Button.vue";
import type { Connection } from "../../stores/types";

defineProps<{
  connection: Connection;
  isActive: boolean;
  color: string;
  indented: boolean;
}>();

defineEmits<{
  select: [];
  delete: [];
}>();
</script>

<template>
  <div
    class="group"
    p-4
    py-2
    rounded-xl
    border
    transition-all
    cursor-pointer
    flex
    items-center
    gap-4
    @click="$emit('select')"
    :class="{
      'ml-4': indented,
      'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]':
        isActive,
      'bg-transparent border-gray-800/60 hover:bg-gray-800/30 hover:border-gray-700':
        !isActive,
    }"
  >
    <div
      w-10
      h-10
      rounded-lg
      flex
      items-center
      justify-center
      :style="{ color: color, backgroundColor: color + '1a' }"
    >
      <div i-lucide-server></div>
    </div>

    <div flex-1 flex flex-col>
      <span font-medium text-gray-200 text-base
        >{{ connection.group }} {{ connection.name }}</span
      >
      <span text-sm text-gray-500 font-mono mt-0.5
        >{{ connection.host }}:{{ connection.port }}/{{
          connection.database
        }}</span
      >
    </div>

    <div flex items-center gap-3 mr-2>
      <div opacity-0 group-hover:opacity-100 transition-opacity>
        <Button
          icon="i-lucide-trash"
          variant="secondary"
          class="hover:!text-red-400 hover:!bg-red-500/10 px-2!"
          @click.stop="$emit('delete')"
        />
      </div>
      <div
        transition-colors
        :class="
          isActive
            ? 'text-emerald-500'
            : 'text-emerald-600/60 group-hover:text-emerald-500/80'
        "
      >
        <div i-lucide-plug text-sm></div>
      </div>
    </div>
  </div>
</template>
