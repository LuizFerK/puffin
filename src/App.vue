<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import Navbar from "./components/Navbar.vue"
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

  // Ctrl+Shift shortcuts for navigation
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    switch (e.key.toLowerCase()) {
      case "d":
        e.preventDefault()
        router.push("/connections")
        break
      case "c":
        e.preventDefault()
        router.push("/collection")
        break
      case "x":
        e.preventDefault()
        router.push("/history")
        break
      case "s":
        e.preventDefault()
        router.push("/settings")
        break
      case "e":
        e.preventDefault()
        // TODO: When enter the console page auto focus on the editor
        router.push("/")
        break
    }
  }
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
