<script setup lang="ts">
import { useSettingsStore, HISTORY_RETENTION_OPTIONS } from "../../stores/settingsStore";
import type { HistoryRetention } from "../../stores/settingsStore";

const {
  historyMaxCount,
  historyRetention,
  updateHistoryMaxCount,
  updateHistoryRetention,
} = useSettingsStore();

const countOptions = [10, 25, 50, 100, 200, 500];

function handleCountChange(e: Event) {
  const val = Number((e.target as HTMLSelectElement).value);
  updateHistoryMaxCount(val);
}

function handleRetentionChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value as HistoryRetention;
  updateHistoryRetention(val);
}
</script>

<template>
  <section>
    <div flex items-center gap-2 mb-4>
      <div i-lucide-history text-emerald-500 text-lg></div>
      <h2 text-base font-semibold text-gray-200>Query History</h2>
    </div>

    <div
      rounded-xl
      border
      border-gray-800
      bg="gray-900/30"
      overflow-hidden
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
          <div text-sm font-medium text-gray-200>Maximum queries</div>
          <div text-xs text-gray-500>Oldest entries are removed when the limit is reached</div>
        </div>
        <select
          :value="historyMaxCount"
          @change="handleCountChange"
          class="settings-select"
        >
          <option
            v-for="opt in countOptions"
            :key="opt"
            :value="opt"
          >
            {{ opt }}
          </option>
        </select>
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
          <div text-sm font-medium text-gray-200>Keep history for</div>
          <div text-xs text-gray-500>Queries older than this are automatically removed</div>
        </div>
        <select
          :value="historyRetention"
          @change="handleRetentionChange"
          class="settings-select"
        >
          <option
            v-for="opt in HISTORY_RETENTION_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-select {
  appearance: none;
  background-color: rgba(31, 41, 55, 0.5);
  border: 1px solid #374151;
  border-radius: 8px;
  color: #d1d5db;
  font-size: 13px;
  padding: 6px 32px 6px 12px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}

.settings-select:hover {
  border-color: #4b5563;
}

.settings-select:focus {
  border-color: rgba(16, 185, 129, 0.5);
}

.settings-select option {
  background-color: #1f2937;
  color: #d1d5db;
}
</style>
