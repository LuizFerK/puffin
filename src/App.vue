<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import Navbar from "./components/Navbar.vue";

const router = useRouter();
const navbarVisible = ref(true);

function handleShortcuts(e: KeyboardEvent) {
  // Ctrl+B -> toggle navbar
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "b") {
    e.preventDefault();
    navbarVisible.value = !navbarVisible.value;
    return;
  }

  // Ctrl+Shift shortcuts for navigation
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    switch (e.key.toLowerCase()) {
      case "d":
        e.preventDefault();
        router.push("/connections");
        break;
      case "f":
        e.preventDefault();
        router.push("/collection");
        break;
      case "h":
        e.preventDefault();
        router.push("/history");
        break;
      case "e":
        e.preventDefault();
        router.push("/");
        break;
    }
  }
}

onMounted(() => document.addEventListener("keydown", handleShortcuts));
onUnmounted(() => document.removeEventListener("keydown", handleShortcuts));
</script>

<template>
  <div flex h-screen bg-gray-950 overflow-hidden>
    <aside
      :style="{ marginLeft: navbarVisible ? '0' : '-14rem' }"
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
}
button {
  border: none;
  background: none;
}
</style>
