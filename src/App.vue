<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
</script>

<template>
  <!-- Hidden Radio Buttons for Theme State -->
  <input hidden type="radio" name="theme" id="theme-light" />
  <input hidden type="radio" name="theme" id="theme-dark" />
  <input hidden type="radio" name="theme" id="theme-transparent" checked />

    <div class="app-wrapper">
      <div p-2 flex-grow flex>
        <Sidebar />

        <main flex-1 relative overflow-hidden>
          <router-view></router-view>
        </main>
      </div>
    </div>
</template>
