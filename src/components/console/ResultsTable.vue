<script setup lang="ts">
defineProps<{
  columns: string[];
  rows: (string | number | boolean | null)[][];
}>();

defineEmits<{
  "copy-cell": [e: MouseEvent, value: unknown];
}>();
</script>

<template>
  <div flex-1 overflow-auto>
    <table text-left text-xs font-mono border-collapse>
      <thead>
        <tr text-gray-500 border-b border-gray="800/60">
          <th font-medium uppercase py-3 px-4 w-12>#</th>
          <th
            v-for="col in columns"
            :key="col"
            font-medium
            py-3
            px-4
            border-l
            border-gray="800/10"
          >
            {{ col }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in rows"
          :key="i"
          border-b
          border-gray="800/40"
          hover:bg-gray="800/20"
          transition-colors
        >
          <td py-2.5 px-4 text-gray-500>{{ i + 1 }}</td>
          <td
            v-for="(cell, j) in row"
            :key="j"
            py-2.5
            px-4
            max-w-xs
            truncate
            whitespace-nowrap
            overflow-hidden
            border-l
            border-gray="800/10"
            hover:bg-gray="800/20"
            cursor-pointer
            select-none
            :class="cell === null ? 'text-gray-600 italic' : 'text-gray-300'"
            @dblclick="$emit('copy-cell', $event, cell)"
          >
            {{ cell === null ? "NULL" : cell }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
