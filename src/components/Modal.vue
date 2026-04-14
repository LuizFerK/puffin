<script setup lang="ts">
import Button from "./Button.vue"

defineProps<{
  open: boolean
  title?: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" fixed inset-0 z-50 flex items-center justify-center>
        <!-- Backdrop -->
        <div
          absolute
          inset-0
          bg="black/60"
          backdrop-blur-sm
          @click="emit('close')"
        ></div>

        <!-- Panel -->
        <div
          relative
          bg-gray-900
          border
          border-gray-800
          rounded-xl
          shadow-2xl
          w-full
          max-w-md
          mx-4
          overflow-hidden
          @click.stop
        >
          <!-- Header -->
          <div
            v-if="title"
            px-6
            py-4
            border-b
            border-gray-800
            flex
            items-center
            justify-between
          >
            <h3 text-base font-semibold text-gray-200>{{ title }}</h3>
            <Button
              icon="i-lucide-x"
              variant="secondary"
              @click="emit('close')"
              px-2="!"
            />
          </div>

          <!-- Body -->
          <div px-6 py-5>
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            px-6
            py-4
            border-t
            border-gray-800
            flex
            justify-end
            gap-3
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child {
  transform: scale(0.95);
  opacity: 0;
}
.modal-leave-to > div:last-child {
  transform: scale(0.95);
  opacity: 0;
}
</style>
