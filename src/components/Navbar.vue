<script setup lang="ts">
import { useRoute, useRouter } from "vue-router"
import { version } from "../../package.json"
import Button from "./Button.vue"
import { NAV_ITEMS, SETTINGS_ITEM } from "../navigation"

const route = useRoute()
const router = useRouter()

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <aside w-64 bg-gray-950 border-r border-gray-800 flex flex-col flex-shrink-0>
    <!-- Logo area -->
    <div
      px-6
      py-5
      flex
      items-center
      justify-between
      mb-6
      border-b
      border-gray-800
    >
      <div flex items-center gap-2>
        <img src="/logo.png" w-8 shadow-lg shadow-green="500/20" />
        <span text-white font-semibold italic text-xl>Puffin</span>
      </div>
      <span
        px-1
        pt-0.5
        rounded
        bg-gray-800
        text="[10px]"
        text-gray-400
        border
        border-gray-700
        >v{{ version }}</span
      >
    </div>

    <!-- Navigation Middle -->
    <nav px-4 flex-1 flex flex-col gap-1>
      <Button
        v-for="item in NAV_ITEMS"
        :key="item.path"
        :icon="item.icon + ' text-lg'"
        :variant="route.path === item.path ? 'primary' : 'secondary'"
        @click="navigate(item.path)"
        justify-start
        py-3
      >
        {{ item.label }}
        <div flex-1></div>
        <span text-xs text-gray-600 w-9>⌘ + {{ item.shortcut }}</span>
      </Button>
    </nav>

    <div flex p-7>
      <span text-xs text-gray-600>Toggle sidebar</span>
      <div flex-1></div>
      <span text-xs text-gray-600>Ctrl + B</span>
    </div>

    <!-- Bottom Actions -->
    <div mt-auto p-4 border-t border-gray="800/50">
      <Button
        :icon="SETTINGS_ITEM.icon + ' text-lg'"
        :variant="route.path === SETTINGS_ITEM.path ? 'primary' : 'secondary'"
        @click="navigate(SETTINGS_ITEM.path)"
        justify-start
        w-full
        px-4
        py-2
      >
        {{ SETTINGS_ITEM.label }}
        <div flex-1></div>
        <span text-xs text-gray-600 w-9>⌘ + {{ SETTINGS_ITEM.shortcut }}</span>
      </Button>
    </div>
  </aside>
</template>
