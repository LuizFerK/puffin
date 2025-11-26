<script setup lang="ts">
import { ref } from 'vue'
import { Home, Settings, User, Palette, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const isCollapsed = ref(false)
const isThemeOpen = ref(false)

const menuItems = [
  { path: '/', icon: Home, label: 'Page 1' },
  { path: '/page2', icon: User, label: 'Page 2' },
  { path: '/page3', icon: Settings, label: 'Page 3' },
]
</script>

<template>
  <aside
    h-full flex="~ col"
    border-r="1px solid [var(--btn-bg)]"
    bg="[var(--btn-bg)]/50"
    backdrop-blur-md
    transition-all duration-300
    :class="isCollapsed ? 'w-20' : 'w-64'"
  >
    <!-- Logo -->
    <div p-6 flex justify-center items-center>
      <img src="/tauri.svg" h-12 alt="Logo" />
    </div>

    <!-- Navigation -->
    <nav flex="~ col" flex-1 gap-2 p-4 justify-center>
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        custom
        v-slot="{ isActive, href, navigate }"
      >
        <a
          :href="href"
          @click="navigate"
          :class="`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-[var(--text)] no-underline ${isActive ? 'bg-[var(--btn-hover)] font-bold' : 'hover:bg-[var(--btn-hover)]'} ${isCollapsed ? 'justify-center' : ''}`"
        >
          <component :is="item.icon" :size="20" />
          <span v-if="!isCollapsed">{{ item.label }}</span>
        </a>
      </router-link>
    </nav>

    <!-- Theme Switcher -->
    <div p-4 border-t="1px solid [var(--btn-bg)]">
      <div relative>
        <button
          w-full flex items-center gap-3 px-4 py-3 rounded-lg bg="[var(--btn-bg)]" text="[var(--text)]" border-none cursor-pointer hover:bg="[var(--btn-hover)]"
          :class="isCollapsed ? 'justify-center' : ''"
          @click="isThemeOpen = !isThemeOpen"
        >
          <Palette :size="20" />
          <span v-if="!isCollapsed">Theme</span>
        </button>

        <!-- Dropdown Content -->
        <div :class="isThemeOpen ? 'block' : 'hidden'" absolute bottom-full left-0 w-full mb-2 bg="[var(--btn-bg)]" rounded-lg shadow-lg backdrop-blur-md z-10>
          <label for="theme-light" block px-4 py-3 cursor-pointer hover:bg="[var(--btn-hover)]" @click="isThemeOpen = false">
            {{ isCollapsed ? 'L' : 'Light' }}
          </label>
          <label for="theme-dark" block px-4 py-3 cursor-pointer hover:bg="[var(--btn-hover)]" @click="isThemeOpen = false">
            {{ isCollapsed ? 'D' : 'Dark' }}
          </label>
          <label for="theme-transparent" block px-4 py-3 cursor-pointer hover:bg="[var(--btn-hover)]" @click="isThemeOpen = false">
            {{ isCollapsed ? 'T' : 'Transparent' }}
          </label>
        </div>
      </div>
    </div>

    <!-- Collapse Toggle -->
    <div p-4 border-t="1px solid [var(--btn-bg)]" flex justify-center>
      <button
        @click="isCollapsed = !isCollapsed"
        p-2 rounded-lg bg="transparent" text="[var(--text)]" border-none cursor-pointer hover:bg="[var(--btn-hover)]"
      >
        <ChevronRight v-if="isCollapsed" :size="20" />
        <ChevronLeft v-else :size="20" />
      </button>
    </div>
  </aside>
</template>
