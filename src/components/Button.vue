<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    icon?: string;
    variant?: "primary" | "secondary";
  }>(),
  {
    variant: "secondary",
  },
);

const buttonClass = computed(() => {
  if (props.variant === "primary") {
    return "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20";
  }
  return "bg-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5";
});
</script>

<template>
  <button
    flex
    items-center
    gap-2
    h-fit
    px-3
    py-2
    rounded-lg
    transition-colors
    duration-200
    cursor-pointer
    text-sm
    font-medium
    outline-none
    :class="buttonClass"
  >
    <div v-if="icon" :class="icon"></div>
    <slot />
  </button>
</template>
