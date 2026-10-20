<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import Navbar from "./components/Navbar.vue"
import { NAV_ITEMS, SETTINGS_ITEM } from "./navigation"
import { useSettingsStore } from "./stores/settingsStore"
import { zoomIn, zoomOut, resetZoom, toggleFullscreen } from "./helpers/windowHelpers"

const router = useRouter()
const navbarVisible = ref(true)
const { loadSettings } = useSettingsStore()

onMounted(() => loadSettings())

function handleWindowShortcuts(e: KeyboardEvent) {
  if (e.key === "F11") {
    e.preventDefault()
    toggleFullscreen()
    return
  }

  if (!(e.ctrlKey || e.metaKey) || e.altKey) return

  const action = { "=": zoomIn, "+": zoomIn, "-": zoomOut, "0": resetZoom }[e.key]
  if (!action) return
  e.preventDefault()
  e.stopPropagation()
  action()
}

function handleShortcuts(e: KeyboardEvent) {
  // Ctrl+B -> toggle navbar
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "b") {
    e.preventDefault()
    navbarVisible.value = !navbarVisible.value
    return
  }

  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return

  // Also keeps Ctrl+Shift+R from hard-reloading the webview
  const key = e.key.toLowerCase()
  const item = [...NAV_ITEMS, SETTINGS_ITEM].find((i) => i.shortcut.toLowerCase() === key)
  if (!item) return
  e.preventDefault()
  router.push(item.path)
}

// Capture phase so Monaco can't swallow these before they reach us
onMounted(() => {
  document.addEventListener("keydown", handleWindowShortcuts, true)
  document.addEventListener("keydown", handleShortcuts)
})
onUnmounted(() => {
  document.removeEventListener("keydown", handleWindowShortcuts, true)
  document.removeEventListener("keydown", handleShortcuts)
})
</script>

<template>
  <div flex h-screen bg-gray-950 overflow-hidden>
    <aside
      :style="{ marginLeft: navbarVisible ? '0' : '-16rem' }"
      transition-all
      duration-200
      ease-in-out
      shrink-0
      flex
    >
      <Navbar />
    </aside>
    <div w-full min-w-0 overflow-hidden bg-gray="900/20">
      <RouterView />
    </div>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: 'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace;
}
button {
  border: none;
  background: none;
}
</style>
