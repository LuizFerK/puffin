<script setup lang="ts">
import { onMounted } from "vue";
import SyntaxHighlighting from "../components/settings/SyntaxHighlighting.vue";
import { useSettingsStore } from "../stores/settingsStore";

const { loadSettings } = useSettingsStore();

onMounted(() => loadSettings());
</script>

<template>
  <div h-full overflow-y-auto>
    <div w="50%" m-auto mt-8 flex flex-col pb-12>
      <!-- Header -->
      <header mb-6 flex justify-between items-center gap-4>
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

      <SyntaxHighlighting />
    </div>
  </div>
</template>
