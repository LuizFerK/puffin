<script setup lang="ts">
import { computed } from "vue";
import Button from "../Button.vue";
import SqlHighlighter from "../SqlHighlighter.vue";
import ColorPicker from "../ColorPicker.vue";
import { useSettingsStore } from "../../stores/settingsStore";
import type { SyntaxColors } from "../../stores/settingsStore";

const {
  syntaxColors,
  defaultSyntaxColors,
  updateSyntaxColor,
  resetSyntaxColors,
} = useSettingsStore();

const SAMPLE_SQL = `SELECT u.id, u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.active = true
  AND u.created_at > '2024-01-01'
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC
LIMIT 10;`;

interface TokenColorEntry {
  key: keyof SyntaxColors;
  label: string;
  example: string;
}

const tokenEntries: TokenColorEntry[] = [
  { key: "keyword", label: "Keywords", example: "SELECT, FROM, WHERE" },
  { key: "function", label: "Functions", example: "COUNT, AVG, SUM" },
  { key: "string", label: "Strings", example: "'hello world'" },
  { key: "number", label: "Numbers", example: "42, 3.14" },
  { key: "comment", label: "Comments", example: "-- note" },
  { key: "type", label: "Types", example: "INTEGER, TEXT" },
  { key: "punct", label: "Punctuation", example: "( ) , ; ." },
  { key: "ident", label: "Identifiers", example: "table_name, col" },
];

const isDefault = computed(() => {
  return tokenEntries.every(
    (entry) =>
      syntaxColors.value[entry.key] === defaultSyntaxColors.value[entry.key]
  );
});

function handleColorChange(key: keyof SyntaxColors, color: string) {
  updateSyntaxColor(key, color);
}
</script>

<template>
  <section>
    <div flex items-center justify-between mb-4>
      <div flex items-center gap-2 py-2>
        <div i-lucide-palette text-emerald-500 text-lg></div>
        <h2 text-base font-semibold text-gray-200>Syntax Highlighting</h2>
      </div>
      <Button
        v-if="!isDefault"
        icon="i-lucide-rotate-ccw"
        variant="secondary"
        @click="resetSyntaxColors"
      >
        Reset
      </Button>
    </div>

    <!-- Color entries grid -->
    <div
      rounded-xl
      border
      border-gray-800
      bg="gray-900/30"
    >
      <div
        v-for="(entry, idx) in tokenEntries"
        :key="entry.key"
        flex
        items-center
        gap-4
        px-5
        py-3.5
        :class="{ 'border-t border-gray-800': idx > 0 }"
        hover:bg="gray-800/30"
        transition-colors
      >
        <!-- Color picker -->
        <ColorPicker
          :model-value="syntaxColors[entry.key]"
          @update:model-value="handleColorChange(entry.key, $event)"
        />

        <!-- Label & example -->
        <div flex-1 min-w-0>
          <div text-sm font-medium text-gray-200 mb-1>{{ entry.label }}</div>
          <div text-xs text-gray-500 font-mono truncate>
            {{ entry.example }}
          </div>
        </div>

        <!-- Hex value -->
        <code
          text-xs
          font-mono
          text-gray-500
          bg="gray-800/50"
          px-2
          py-1
          rounded
        >
          {{ syntaxColors[entry.key] }}
        </code>
      </div>
    </div>

    <!-- Live Preview -->
    <div mt-6>
      <div flex items-center gap-2 mb-3>
        <div i-lucide-eye text-gray-500></div>
        <span text-sm text-gray-500 font-medium>Live Preview</span>
      </div>
      <div
        rounded-xl
        border
        border-gray-800
        bg="[#0d1117]"
        overflow-hidden
      >
        <div
          px-3
          py-2
          border-b
          border-gray-800
          flex
          items-center
          gap-2
          bg="gray-900/40"
        >
          <div i-lucide-code-2 color-gray text-sm></div>
          <span text-xs text-gray-600>preview.sql</span>
        </div>
        <SqlHighlighter
          :sql="SAMPLE_SQL"
          class="preview-code"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.preview-code {
  padding: 16px 20px;
  font-size: 13px;
  font-family: monospace;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
}
</style>
