<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import Button from './Button.vue'

const route = useRoute()
const router = useRouter()

const navItems = [
  { path: '/connections', label: 'Connections', icon: 'i-lucide-database' },
  { path: '/', label: 'Query Console', icon: 'i-lucide-terminal' },
  { path: '/collection', label: 'Collection', icon: 'i-lucide-bookmark' },
]

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <aside w-56 bg-gray-950 border-r border-gray-800 flex flex-col flex-shrink-0>
    <!-- Logo area -->
    <div px-4 py-5 flex items-center gap-3 mb-6 border-b border-gray-800>
      <div w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue="500/20">
        <span text-white font-bold text-lg>P</span>
      </div>
      <span text-white>Puffin</span>
    </div>

    <!-- Navigation Middle -->
    <nav px-4 flex-1 flex flex-col gap-1>
      <Button
        v-for="item in navItems"
        :key="item.path"
        :icon="item.icon + ' text-lg'"
        :variant="route.path === item.path ? 'primary' : 'secondary'"
        @click="navigate(item.path)"
        justify-start py-3
      >
        {{ item.label }}
      </Button>
    </nav>

    <!-- Bottom Actions -->
    <div mt-auto p-4 border-t border-gray="800/50">
      <Button
        icon="i-lucide-settings text-lg"
        :variant="route.path === '/settings' ? 'primary' : 'secondary'"
        @click="navigate('/settings')"
        justify-start w-full px-4 py-2
      >
        Settings
      </Button>
    </div>
  </aside>
</template>
