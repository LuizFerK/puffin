<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

interface Option {
  value: string | number;
  label: string;
}

const props = defineProps<{
  modelValue: string | number;
  options: Option[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();

const isOpen = ref(false);
const selectRef = ref<HTMLElement | null>(null);

const selectedLabel = () => {
  const opt = props.options.find((o) => o.value === props.modelValue);
  return opt?.label ?? String(props.modelValue);
};

function toggle() {
  isOpen.value = !isOpen.value;
}

function select(value: string | number) {
  emit("update:modelValue", value);
  isOpen.value = false;
}

function onClickOutside(e: MouseEvent) {
  if (selectRef.value && !selectRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", onClickOutside));
onBeforeUnmount(() => document.removeEventListener("mousedown", onClickOutside));
</script>

<template>
  <div ref="selectRef" class="select-root" relative>
    <!-- Trigger -->
    <button
      @click="toggle"
      class="select-trigger"
      :class="{ 'select-trigger--open': isOpen }"
    >
      <span text-sm>{{ selectedLabel() }}</span>
      <div
        i-lucide-chevron-down
        text-gray-500
        text-xs
        transition-transform
        duration-150
        :class="{ 'rotate-180': isOpen }"
      ></div>
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="select-dropdown"
      >
        <button
          v-for="opt in options"
          :key="opt.value"
          class="select-option"
          :class="{ 'select-option--active': opt.value === modelValue }"
          @click="select(opt.value)"
        >
          <span>{{ opt.label }}</span>
          <div
            v-if="opt.value === modelValue"
            i-lucide-check
            text-emerald-500
            text-xs
          ></div>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.select-root {
  flex-shrink: 0;
}

.select-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(31, 41, 55, 0.5);
  border: 1px solid #374151;
  border-radius: 8px;
  color: #d1d5db;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  min-width: 100px;
  justify-content: space-between;
}

.select-trigger:hover {
  border-color: #4b5563;
  background: rgba(31, 41, 55, 0.8);
}

.select-trigger--open {
  border-color: rgba(16, 185, 129, 0.5);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 100%;
  background: #1a1f2e;
  border: 1px solid #2d3548;
  border-radius: 10px;
  padding: 4px;
  z-index: 50;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.03);
  overflow: hidden;
}

.select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.1s ease, color 0.1s ease;
  white-space: nowrap;
  outline: none;
}

.select-option:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #e5e7eb;
}

.select-option--active {
  color: #d1d5db;
}

/* Transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
