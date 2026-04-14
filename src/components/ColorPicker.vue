<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const isOpen = ref(false);
const pickerRef = ref<HTMLElement | null>(null);
const hexInput = ref(props.modelValue);

watch(
  () => props.modelValue,
  (v) => (hexInput.value = v)
);

// Preset palette
const presets = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#c084fc", "#d946ef",
  "#ec4899", "#f43f5e", "#fb7185", "#fda4af",
  "#fbbf24", "#34d399", "#60a5fa", "#9ca3af",
  "#6ee7b7", "#ffa348", "#d1d5db", "#f3f4f6",
];

function selectPreset(color: string) {
  hexInput.value = color;
  emit("update:modelValue", color);
}

function handleHexInput() {
  const v = hexInput.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    emit("update:modelValue", v);
  }
}

function handleNativeInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  hexInput.value = val;
  emit("update:modelValue", val);
}

function togglePicker() {
  isOpen.value = !isOpen.value;
}

function onClickOutside(e: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", onClickOutside));
onBeforeUnmount(() => document.removeEventListener("mousedown", onClickOutside));
</script>

<template>
  <div ref="pickerRef" class="picker-root" relative>
    <!-- Swatch trigger -->
    <button
      class="picker-swatch"
      :style="{ backgroundColor: modelValue }"
      @click="togglePicker"
    >
      <div
        class="picker-swatch-inner"
        :class="{ 'picker-swatch-inner--open': isOpen }"
      ></div>
    </button>

    <!-- Popup -->
    <Transition name="picker-pop">
      <div
        v-if="isOpen"
        class="picker-popup"
      >
        <!-- Preset grid -->
        <div class="picker-presets">
          <button
            v-for="color in presets"
            :key="color"
            class="picker-preset"
            :class="{ 'picker-preset--active': color === modelValue }"
            :style="{ backgroundColor: color }"
            @click="selectPreset(color)"
          >
            <div
              v-if="color === modelValue"
              i-lucide-check
              text-white
              text-xs
              style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
            ></div>
          </button>
        </div>

        <!-- Divider -->
        <div h-px bg-gray-800 my-2></div>

        <!-- Custom color row -->
        <div flex items-center gap-2>
          <!-- Native picker (hidden behind swatch) -->
          <label
            class="picker-custom-swatch"
            :style="{ backgroundColor: modelValue }"
          >
            <input
              type="color"
              :value="modelValue"
              @input="handleNativeInput"
              class="picker-native"
            />
          </label>
          <input
            v-model="hexInput"
            @change="handleHexInput"
            @keyup.enter="handleHexInput"
            class="picker-hex-input"
            maxlength="7"
            spellcheck="false"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.picker-root {
  flex-shrink: 0;
}

.picker-swatch {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color 0.15s ease, transform 0.15s ease;
  outline: none;
  padding: 0;
}

.picker-swatch:hover {
  border-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.08);
}

.picker-popup {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #1a1f2e;
  border: 1px solid #2d3548;
  border-radius: 12px;
  padding: 12px;
  z-index: 50;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.03);
}

.picker-presets {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.picker-preset {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  outline: none;
}

.picker-preset:hover {
  transform: scale(1.15);
  border-color: rgba(255, 255, 255, 0.2);
}

.picker-preset--active {
  border-color: rgba(255, 255, 255, 0.5);
}

.picker-custom-swatch {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #374151;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.picker-native {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

.picker-hex-input {
  flex: 1;
  background: rgba(31, 41, 55, 0.5);
  border: 1px solid #374151;
  border-radius: 6px;
  color: #d1d5db;
  font-family: monospace;
  font-size: 12px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 0.15s ease;
  min-width: 0;
}

.picker-hex-input:focus {
  border-color: rgba(16, 185, 129, 0.5);
}

/* Transition */
.picker-pop-enter-active,
.picker-pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.picker-pop-enter-from,
.picker-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
