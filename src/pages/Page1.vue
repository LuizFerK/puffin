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
  <div flex="~ col" justify-center text-center h-full overflow-y-auto p-8>
    <h1 text="4xl" font-bold mb-8>Welcome to Tauri + Vue</h1>

    <div flex justify-center gap-8 mb-8>
      <a href="https://vite.dev" target="_blank" font-medium class="text-[#646cff] hover:text-[#535bf2]" decoration-none>
        <img src="/vite.svg" h-24 p-6 transition-all duration-700 hover:drop-shadow="[0_0_2em_#747bff]" alt="Vite logo" />
      </a>
      <a href="https://tauri.app" target="_blank" font-medium class="text-[#646cff] hover:text-[#535bf2]" decoration-none>
        <img src="/tauri.svg" h-24 p-6 transition-all duration-700 hover:drop-shadow="[0_0_2em_#24c8db]" alt="Tauri logo" />
      </a>
    </div>
    <p mb-8>Click on the Tauri and Vite logos to learn more.</p>

    <form
      flex justify-center gap-2
      @submit.prevent="greet"
    >
      <input
        id="greet-input"
        v-model="name"
        rounded-lg border="~ transparent" px-5 py="2.5" text-base font-medium text-inherit bg="[var(--btn-bg)]" transition-colors duration-250 shadow-sm outline-none
        placeholder="Enter a name..."
      />
      <button 
        type="submit"
        cursor-pointer rounded-lg border="~ transparent" px-5 py="2.5" text-base font-medium text-inherit bg="[var(--btn-bg)]" transition-colors duration-250 shadow-sm outline-none hover-border="[#396cd8]" active-bg="[var(--btn-hover)]" active-border="[#396cd8]"
      >
        Greet
      </button>
    </form>
    <p mt-4>{{ greetMsg }}</p>
  </div>
</template>
