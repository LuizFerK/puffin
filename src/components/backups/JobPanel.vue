<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import Button from "../Button.vue"
import PgErrorMessage from "../console/PgErrorMessage.vue"
import { formatDuration } from "../../helpers/backupHelpers"
import type { BackupJob } from "../../types"

const props = defineProps<{
  job: BackupJob
}>()

defineEmits<{
  dismiss: []
}>()

const logRef = ref<HTMLElement | null>(null)

const STATUS = {
  running: { icon: "i-lucide-loader-2 animate-spin", color: "text-yellow-500" },
  success: { icon: "i-lucide-circle-check", color: "text-emerald-500" },
  error: { icon: "i-lucide-circle-x", color: "text-red-400" },
}

const status = computed(() => STATUS[props.job.status])

const elapsed = computed(() =>
  props.job.finishedAt ? formatDuration(props.job.finishedAt - props.job.startedAt) : null,
)

// Follow the tail only while the user hasn't scrolled up to read something.
// The log is replaced once per batch, so this runs per batch, not per line.
watch(
  () => props.job.log,
  async () => {
    const el = logRef.value
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    await nextTick()
    if (atBottom) el.scrollTop = el.scrollHeight
  },
)
</script>

<template>
  <div flex flex-col min-h-0 flex-1 border border-gray-800 rounded-xl overflow-hidden>
    <div h-11 px-4 flex items-center gap-2 border-b border-gray-800 text-xs shrink-0>
      <div :class="[status.icon, status.color]" text-sm></div>
      <span text-gray-200 font-medium>{{ job.title }}</span>
      <span v-if="elapsed" text-gray-600>· {{ elapsed }}</span>
      <div flex-1></div>
      <Button
        v-if="job.status !== 'running'"
        icon="i-lucide-x"
        variant="secondary"
        title="Dismiss"
        class="px-2! py-1!"
        @click="$emit('dismiss')"
      />
    </div>

    <div v-if="job.error" flex flex-col px-4 py-3 border-b border-gray-800 bg-red-500="/5">
      <PgErrorMessage :error="job.error" />
    </div>

    <div ref="logRef" bg="[#0d1117]" flex-1 overflow-y-auto p-4 min-h-24>
      <pre
        v-if="job.log.length > 0"
        m-0
        font-mono
        text-xs
        leading-5
        text-gray-500
        whitespace-pre-wrap
        break-all
      >{{ job.log.join("\n") }}</pre>
      <span v-else text-xs text-gray-600>Waiting for output...</span>
    </div>
  </div>
</template>
