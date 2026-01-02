<script setup lang="ts">
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const greetMsg = ref('')
const name = ref('')

async function greet() {
  greetMsg.value = await invoke('greet', { name: name.value })
}
</script>

<template>
  <div flex="~ col" gap-2 h-full>
    <div class="glass"rounded-xl ml-2 p-2 flex-grow>
      <span>Console</span>
    </div>
    <div class="glass"rounded-xl ml-2 p-2 flex-grow>
      <span>Result</span>
    </div>
  </div>
</template>
