<script setup lang="ts">
import { onMounted, computed } from "vue"
import Button from "../components/Button.vue"
import SyntaxHighlighting from "../components/settings/SyntaxHighlighting.vue"
import HistorySettings from "../components/settings/HistorySettings.vue"
import { useSettingsStore } from "../stores/settingsStore"

const { loadSettings, isHistoryDefault, resetAllSettings } = useSettingsStore()
const { syntaxColors, defaultSyntaxColors } = useSettingsStore()

onMounted(() => loadSettings())

const isAllDefault = computed(() => {
  const colorsDefault = (
    Object.keys(
      defaultSyntaxColors.value,
    ) as (keyof typeof defaultSyntaxColors.value)[]
  ).every((k) => syntaxColors.value[k] === defaultSyntaxColors.value[k])
  return colorsDefault && isHistoryDefault.value
})
</script>

<template>
  <div h-full overflow-y-auto>
    <div w="50%" m-auto mt-8 flex flex-col gap-8 pb-12>
      <!-- Header -->
      <header flex justify-between items-center gap-4>
        <div>
          <h1
            text-xl
            font-semibold
            bg-gradient-to-r
            from-gray-100
            to-gray-400
            bg-clip-text
            text-transparent
          >
            Settings
          </h1>
          <p text-sm text-gray-500>Customize your editor experience</p>
        </div>
      </header>

      <!-- TODO: Shortcuts config -->
      <!-- TODO: Format query config (on save, on favorite) -->
      <!-- TODO: Formatter config (indentation, upper or lower cases) -->
      <HistorySettings />
      <SyntaxHighlighting />

      <!-- Reset All -->
      <div v-if="!isAllDefault" border-t border-gray-800 pt-6 flex justify-end>
        <Button
          icon="i-lucide-rotate-ccw"
          variant="secondary"
          class="!text-red-400 hover:!bg-red-500/10"
          @click="resetAllSettings"
        >
          Reset All Defaults
        </Button>
      </div>
    </div>
  </div>
</template>
