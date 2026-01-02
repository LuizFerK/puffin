<script setup lang="ts">
import { ref } from 'vue'
import { LayoutPanelLeft, Play, Database, Zap, Blend } from 'lucide-vue-next'

const isThemeOpen = ref(false)

const menuItems = [
  { path: '/', icon: Play, label: 'Console' },
  { path: '/databases', icon: Database, label: 'Databases' },
  { path: '/queries', icon: Zap, label: 'Queries' },
]
</script>

<template>
  <aside
    w-20 flex="~ col" py-8
    items-center
    class="glass"
    rounded-xl
    transition-all duration-300
  >
    <!-- Logo -->
    <LayoutPanelLeft :size="28" />

    <!-- Navigation -->
    <nav flex="~ col 1" gap-5 p-4 justify-center>
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        custom
        v-slot="{ isActive, href, navigate }"
      >
        <a
          class="button"
          :class="{ 'button-hover': isActive }"
          :href="href"
          @click="navigate"
        >
          <component :is="item.icon" :size="24" />
        </a>
      </router-link>
    </nav>

    <!-- Theme Switcher -->
    <button @click="isThemeOpen = !isThemeOpen">
      <Blend :size="24" />
    </button>
  </aside>
</template>
