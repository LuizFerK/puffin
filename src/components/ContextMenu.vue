<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue"

export interface ContextMenuItem {
  label: string
  icon: string
  action: () => void
}

const props = defineProps<{
  x: number
  y: number
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)
const position = ref({ left: props.x, top: props.y })

const VIEWPORT_MARGIN = 8

// Flip the menu back inside the window when it would overflow an edge
async function clampToViewport() {
  await nextTick()
  const el = menuRef.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  position.value = {
    left: Math.min(props.x, window.innerWidth - width - VIEWPORT_MARGIN),
    top: Math.min(props.y, window.innerHeight - height - VIEWPORT_MARGIN),
  }
}

function select(item: ContextMenuItem) {
  item.action()
  emit("close")
}

function onPointerDown(e: MouseEvent) {
  if (!menuRef.value?.contains(e.target as Node)) emit("close")
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}

const close = () => emit("close")

onMounted(() => {
  clampToViewport()
  document.addEventListener("mousedown", onPointerDown, true)
  document.addEventListener("keydown", onKeydown)
  document.addEventListener("scroll", close, true)
  window.addEventListener("blur", close)
  window.addEventListener("resize", close)
})

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onPointerDown, true)
  document.removeEventListener("keydown", onKeydown)
  document.removeEventListener("scroll", close, true)
  window.removeEventListener("blur", close)
  window.removeEventListener("resize", close)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      class="context-menu"
      :style="{ left: position.left + 'px', top: position.top + 'px' }"
      @contextmenu.prevent
    >
      <button
        v-for="item in items"
        :key="item.label"
        class="context-menu-item"
        @click="select(item)"
      >
        <div :class="item.icon" text-sm shrink-0></div>
        <span>{{ item.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 50;
  min-width: 140px;
  /* Results panel background (gray-950), slightly see-through */
  background: rgba(3, 7, 18, 0.95);
  border: 1px solid #2d3548;
  border-radius: 10px;
  padding: 4px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.03);
}

.context-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  outline: none;
  transition:
    background-color 0.1s ease,
    color 0.1s ease;
}

.context-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
