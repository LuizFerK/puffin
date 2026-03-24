<script setup lang="ts">
import Navbar from './components/Navbar.vue'
</script>

<template>
  <div flex h-screen bg-gray-950>
    <Navbar />
    <RouterView />
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