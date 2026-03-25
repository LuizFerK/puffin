<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: string | number | undefined;
  type?: string;
  placeholder?: string;
}>();

defineEmits<{
  "update:modelValue": [value: string | number | ""];
}>();
</script>

<template>
  <div flex flex-col gap-1>
    <label text-sm text-gray-400 font-medium>{{ label }}</label>
    <input
      :value="modelValue"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
      :type="type ?? 'text'"
      :placeholder="placeholder"
      bg-transparent
      border
      border-gray-800
      rounded-lg
      px-3
      py-2
      text-sm
      text-gray-200
      focus:outline-none
      focus:border-emerald-700
      transition
    />
  </div>
</template>
