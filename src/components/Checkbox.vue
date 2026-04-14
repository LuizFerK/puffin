<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label flex items-center gap-3 cursor-pointer select-none group>
    <input type="checkbox" v-model="model" class="checkbox" />
    <span text-sm text-gray-400 group-hover:text-gray-300 transition-colors>
      <slot />
    </span>
  </label>
</template>

<style scoped>
.checkbox {
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid #374151;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.checkbox:checked {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.5);
}

.checkbox:checked::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #10b981;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox:hover {
  border-color: #4b5563;
}
</style>
