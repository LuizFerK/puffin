<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    class="switch"
    :class="{ 'switch-on': model }"
    @click="model = !model"
  >
    <span class="switch-thumb"></span>
  </button>
</template>

<style scoped>
.switch {
  width: 32px;
  height: 18px;
  border: 1px solid #374151;
  border-radius: 9999px;
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.switch:hover {
  border-color: #4b5563;
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: #6b7280;
  transition: all 0.15s ease;
}

.switch-on {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.5);
}

.switch-on .switch-thumb {
  left: 16px;
  background: #10b981;
}
</style>
