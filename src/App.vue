<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
</script>

<template>
  <!-- Hidden Radio Buttons for Theme State -->
  <input type="radio" name="theme" id="theme-light" class="theme-control" />
  <input type="radio" name="theme" id="theme-dark" class="theme-control" />
  <input type="radio" name="theme" id="theme-transparent" class="theme-control" checked />

  <div class="app-wrapper" flex h-screen overflow-hidden>
    <Sidebar />

    <main flex-1 relative overflow-hidden>
      <router-view></router-view>
    </main>
  </div>
</template>
