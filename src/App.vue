<script setup lang="ts">
import Navbar from './components/Navbar.vue'
</script>

<template>
  <div flex h-screen bg-gray-950>
    <Navbar />
    <div w-full bg-gray="900/20">
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