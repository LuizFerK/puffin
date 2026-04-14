<script setup lang="ts">
import Select from "../Select.vue";
import Button from "../Button.vue";
import { useSettingsStore, HISTORY_RETENTION_OPTIONS } from "../../stores/settingsStore";
import type { HistoryRetention } from "../../stores/settingsStore";

const {
  historyMaxCount,
  historyRetention,
  isHistoryDefault,
  updateHistoryMaxCount,
  updateHistoryRetention,
  resetHistorySettings,
} = useSettingsStore();

const countOptions = [10, 25, 50, 100, 200, 500].map((n) => ({
  value: n,
  label: String(n),
}));

const retentionOptions = HISTORY_RETENTION_OPTIONS.map((o) => ({
  value: o.value as string | number,
  label: o.label,
}));

function onCountChange(val: string | number) {
  updateHistoryMaxCount(Number(val));
}

function onRetentionChange(val: string | number) {
  updateHistoryRetention(val as HistoryRetention);
}
</script>

<template>
  <section>
    <div flex items-center justify-between mb-4>
      <div flex items-center gap-2 py-2>
        <div i-lucide-history text-emerald-500 text-lg></div>
        <h2 text-base font-semibold text-gray-200>Query History</h2>
      </div>
      <Button
        v-if="!isHistoryDefault"
        icon="i-lucide-rotate-ccw"
        variant="secondary"
        @click="resetHistorySettings"
      >
        Reset
      </Button>
    </div>

    <div
      rounded-xl
      border
      border-gray-800
      bg="gray-900/30"
    >
      <!-- Max queries -->
      <div
        flex
        items-center
        justify-between
        gap-4
        px-5
        py-4
      >
        <div>
          <div text-sm font-medium text-gray-200 mb-1>Maximum queries</div>
          <div text-xs text-gray-500>Oldest entries are removed when the limit is reached</div>
        </div>
        <Select
          :model-value="historyMaxCount"
          :options="countOptions"
          @update:model-value="onCountChange"
        />
      </div>

      <!-- Retention period -->
      <div
        flex
        items-center
        justify-between
        gap-4
        px-5
        py-4
        border-t
        border-gray-800
      >
        <div>
          <div text-sm font-medium text-gray-200 mb-1>Keep history for</div>
          <div text-xs text-gray-500>Queries older than this are automatically removed</div>
        </div>
        <Select
          :model-value="historyRetention"
          :options="retentionOptions"
          @update:model-value="onRetentionChange"
        />
      </div>
    </div>
  </section>
</template>
