<script setup lang="ts">
import Switch from "../Switch.vue"
import { useSettingsStore } from "../../stores/settingsStore"

const { vimMode, updateVimMode } = useSettingsStore()
</script>

<template>
  <section>
    <div flex items-center gap-2 py-2 mb-4>
      <div i-lucide-square-terminal text-emerald-500 text-lg></div>
      <h2 text-base font-semibold text-gray-200>Editor</h2>
    </div>

    <div rounded-xl border border-gray-800 bg="gray-900/30">
      <!-- Vim mode -->
      <!-- A label forwards clicks anywhere in the row to the switch -->
      <label flex items-center justify-between gap-4 px-5 py-4 cursor-pointer select-none>
        <div>
          <div text-sm font-medium text-gray-200 mb-1>Vim mode</div>
          <div text-xs text-gray-500>
            Use Vim keybindings in the query editor
          </div>
        </div>
        <Switch :model-value="vimMode" @update:model-value="updateVimMode" />
      </label>
    </div>
  </section>
</template>
