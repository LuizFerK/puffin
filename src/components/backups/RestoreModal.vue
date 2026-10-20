<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from "vue"
import Button from "../Button.vue"
import Modal from "../Modal.vue"
import FormInput from "../FormInput.vue"
import ConnectionPicker from "./ConnectionPicker.vue"
import SelectableCard from "./SelectableCard.vue"
import { formatDateTime } from "../../helpers/dateHelpers"
import type { Connection, Backup, RestoreMode } from "../../types"

const props = defineProps<{
  open: boolean
  backup: Backup | null
  connections: Connection[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [target: Connection, mode: RestoreMode]
}>()

const MODES = [
  {
    value: "replace",
    label: "Replace objects",
    description:
      "Drops and recreates every object in the backup. Objects that are not in the backup stay untouched.",
    icon: "i-lucide-replace",
  },
  {
    value: "recreate",
    label: "Recreate database",
    description:
      "Drops the whole database, disconnecting every open session, and restores into a fresh one.",
    icon: "i-lucide-database-zap",
  },
] satisfies { value: RestoreMode; label: string; description: string; icon: string }[]

type Mode = (typeof MODES)[number]

const STEPS = ["Target", "Mode", "Confirm"]

// The parent remounts this modal on every open, so this is always a fresh start.
// Nothing is preselected: the target of a destructive restore must be a deliberate choice.
const step = ref(0)
const targetId = ref<string | null>(null)
const mode = shallowRef<Mode>(MODES[0])
const confirmText = ref("")
const confirmInput = ref<InstanceType<typeof FormInput> | null>(null)

const target = computed(() => props.connections.find((c) => c.id === targetId.value) ?? null)
const isSource = computed(() => target.value?.id === props.backup?.connectionId)
const isLastStep = computed(() => step.value === STEPS.length - 1)
const canAdvance = computed(() => step.value !== 0 || target.value !== null)
const canRestore = computed(() => target.value !== null && confirmText.value === target.value.database)

// Reaching the last step always starts from an empty confirmation
watch(isLastStep, async (last) => {
  if (!last) return
  confirmText.value = ""
  await nextTick()
  confirmInput.value?.focus()
})

function next() {
  if (canAdvance.value) step.value++
}

function back() {
  if (step.value === 0) emit("close")
  else step.value--
}

function confirm() {
  if (target.value && canRestore.value) emit("confirm", target.value, mode.value.value)
}

function stepClass(i: number) {
  if (i < step.value) return "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
  if (i === step.value) return "border-emerald-500/60 text-emerald-400"
  return "border-gray-800 text-gray-600"
}
</script>

<template>
  <Modal :open="open" title="Restore backup" @close="emit('close')">
    <div v-if="backup" flex flex-col gap-5 text-sm>
      <!-- Step indicator -->
      <div flex items-center gap-2 text-xs>
        <template v-for="(label, i) in STEPS" :key="label">
          <div v-if="i > 0" flex-1 h-px :class="i <= step ? 'bg-emerald-500/40' : 'bg-gray-800'"></div>
          <div flex items-center gap-1.5 :class="i <= step ? 'text-gray-200' : 'text-gray-600'">
            <span
              w-5
              h-5
              rounded-full
              flex
              items-center
              justify-center
              text="[10px]"
              font-semibold
              border
              :class="stepClass(i)"
            >
              <div v-if="i < step" i-lucide-check></div>
              <template v-else>{{ i + 1 }}</template>
            </span>
            {{ label }}
          </div>
        </template>
      </div>

      <!-- Step 1: target -->
      <div v-if="step === 0" flex flex-col gap-3>
        <p text-gray-400>
          Where should the backup of
          <span text-gray-200 font-medium>{{ backup.connectionName }}</span>
          from {{ formatDateTime(backup.createdAt) }} be restored?
        </p>
        <ConnectionPicker
          v-model="targetId"
          :connections="connections"
          :source-id="backup.connectionId"
        />
        <p v-if="isSource" text-xs text-amber-400>
          This is the connection the backup was taken from. Anything changed since then will be
          lost.
        </p>
      </div>

      <!-- Step 2: mode -->
      <div v-else-if="step === 1" flex flex-col gap-2>
        <p text-gray-400 mb-1>How should the target database be overwritten?</p>
        <SelectableCard
          v-for="m in MODES"
          :key="m.value"
          :selected="mode === m"
          @click="mode = m"
        >
          <div
            :class="[m.icon, mode === m ? 'text-emerald-400' : 'text-gray-600']"
            mt-0.5
            shrink-0
          ></div>
          <div flex flex-col gap-0.5>
            <span text-gray-200>{{ m.label }}</span>
            <span text-xs text-gray-500>{{ m.description }}</span>
          </div>
        </SelectableCard>
      </div>

      <!-- Step 3: confirm -->
      <div v-else-if="target" flex flex-col gap-4>
        <dl grid gap-x-4 gap-y-2 m-0 text-xs style="grid-template-columns: auto 1fr">
          <dt text-gray-500>Backup</dt>
          <dd m-0 text-gray-300 truncate>
            {{ backup.connectionName }}
            <span text-gray-500>· {{ formatDateTime(backup.createdAt) }}</span>
          </dd>
          <dt text-gray-500>Target</dt>
          <dd m-0 text-gray-300 font-mono truncate>
            {{ target.host }}:{{ target.port }}/{{ target.database }}
          </dd>
          <dt text-gray-500>Mode</dt>
          <dd m-0 text-gray-300>{{ mode.label }}</dd>
        </dl>

        <div flex flex-col gap-3 p-3 rounded-lg bg-red-500="/5" border border-red-500="/30">
          <div flex gap-2 text-red-400>
            <div i-lucide-triangle-alert mt-0.5 shrink-0></div>
            <span text-xs leading-5>
              This overwrites data in
              <span font-mono font-semibold>{{ target.database }}</span>
              and cannot be undone.
            </span>
          </div>
          <FormInput
            ref="confirmInput"
            v-model="confirmText"
            tone="danger"
            mono
            spellcheck="false"
            autocomplete="off"
            @keydown.enter="confirm"
          >
            <template #label>
              <span text-xs font-normal>
                Type <span font-mono font-semibold text-gray-200>{{ target.database }}</span> to
                confirm
              </span>
            </template>
          </FormInput>
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="secondary" @click="back">{{ step === 0 ? "Cancel" : "Back" }}</Button>
      <Button
        v-if="!isLastStep"
        variant="primary"
        :disabled="!canAdvance"
        @click="next"
      >
        Next
        <div i-lucide-chevron-right></div>
      </Button>
      <Button
        v-else
        variant="danger"
        icon="i-lucide-archive-restore"
        :disabled="!canRestore"
        @click="confirm"
      >
        Restore
      </Button>
    </template>
  </Modal>
</template>
