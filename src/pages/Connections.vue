<script setup lang="ts">
import { ref, onMounted } from "vue"
import Button from "../components/Button.vue"
import Modal from "../components/Modal.vue"
import ConnectionForm from "../components/connections/ConnectionForm.vue"
import ConnectionCard from "../components/connections/ConnectionCard.vue"
import { useConnectionStore } from "../stores/connectionStore"
import type { Connection } from "../types"

const {
  connections,
  activeConnectionId,
  groupedConnections,
  loadConnections,
  addConnection,
  removeConnection,
  setActiveConnection,
} = useConnectionStore()

// Delete confirmation
const connectionToDelete = ref<Connection | null>(null)
const isDeleteModalOpen = ref(false)

function openDeleteModal(conn: Connection) {
  connectionToDelete.value = conn
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  if (connectionToDelete.value) {
    await removeConnection(connectionToDelete.value.id)
  }
  isDeleteModalOpen.value = false
  connectionToDelete.value = null
}

const COLORS = [
  "#4ade80",
  "#facc15",
  "#38bdf8",
  "#f87171",
  "#c084fc",
  "#fb923c",
]

function getColor(index: number) {
  return COLORS[index % COLORS.length]
}

onMounted(() => loadConnections())

// Form Logic
const isFormVisible = ref(false)

const emptyFormState = (): Omit<Connection, "id"> => ({
  name: "",
  group: "",
  host: "",
  port: "",
  database: "",
  username: "",
  password: "",
})

const formData = ref({ ...emptyFormState() })

async function submitForm() {
  if (
    !formData.value.name ||
    !formData.value.host ||
    formData.value.port === ""
  ) {
    alert("Please fill in at least the Name, Host, and Port.")
    return
  }

  await addConnection(formData.value)
  formData.value = { ...emptyFormState() }
  isFormVisible.value = false
}

function cancelForm() {
  formData.value = { ...emptyFormState() }
  isFormVisible.value = false
}
</script>

<template>
  <div h-full overflow-y-auto>
    <div
      max-w="90%"
      lg:max-w="50%"
      xl:max-w="30%"
      m-auto
      mt-8
      flex
      flex-col
      pb-12
    >
      <!-- Header -->
      <header mb-4 flex justify-between items-center gap-4>
        <div>
          <h1
            text-xl
            font-semibold
            bg-gradient-to-r
            from-gray-100
            to-gray-400
            bg-clip-text
            text-transparent
          >
            Database Connections
          </h1>
          <p text-sm text-gray-500>Manage your PostgreSQL connections</p>
        </div>
        <Button
          v-if="!isFormVisible"
          @click="isFormVisible = true"
          icon="i-lucide-plus"
          variant="primary"
        >
          New Connection
        </Button>
        <Button v-else @click="cancelForm" variant="secondary"> Cancel </Button>
      </header>

      <!-- New Connection Form -->
      <ConnectionForm
        v-if="isFormVisible"
        v-model="formData"
        @submit="submitForm"
        @cancel="cancelForm"
      />

      <!-- Connection List -->
      <div flex-1 overflow-y-auto pr-2 flex flex-col>
        <div
          v-if="connections.length === 0 && !isFormVisible"
          flex
          items-center
          justify-center
          flex-col
          mt-20
        >
          <div i-lucide-server text-3xl text-gray-800 mb-4></div>
          <p text-gray-500>No connections configured</p>
          <p text-gray-500 text-xs>Click "New Connection" to add one</p>
        </div>

        <div
          v-for="(conns, groupName) in groupedConnections"
          :key="groupName"
          flex
          flex-col
          gap-3
        >
          <!-- Group Header -->
          <div
            v-if="groupName !== 'Ungrouped'"
            flex
            items-center
            gap-4
            mb-1
            mt-6
          >
            <h3
              text-xs
              font-semibold
              text-gray="400/80"
              uppercase
              tracking-widest
            >
              {{ groupName }}
            </h3>
            <div flex-1 h-px bg-gray="800/80"></div>
            <span text-xs text-gray-500 font-medium>{{ conns.length }}</span>
          </div>
          <div v-else mt-6></div>

          <!-- Group Cards -->
          <div
            flex
            flex-col
            gap-3
            :class="{
              'border-l border-gray-800/80': groupName !== 'Ungrouped',
            }"
          >
            <ConnectionCard
              v-for="conn in conns"
              :key="conn.id"
              :connection="conn"
              :is-active="activeConnectionId === conn.id"
              :color="getColor(connections.indexOf(conn))"
              :indented="groupName !== 'Ungrouped'"
              @select="setActiveConnection(conn.id)"
              @delete="openDeleteModal(conn)"
            />
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <Modal
        :open="isDeleteModalOpen"
        title="Delete Connection"
        @close="isDeleteModalOpen = false"
      >
        <p text-sm text-gray-400>
          Are you sure you want to delete
          <span font-semibold text-gray-200>{{ connectionToDelete?.name }}</span
          >? This action cannot be undone.
        </p>
        <template #footer>
          <Button variant="secondary" @click="isDeleteModalOpen = false"
            >Cancel</Button
          >
          <Button
            variant="primary"
            class="!bg-red-500/10 !text-red-400 hover:!bg-red-500/20"
            @click="confirmDelete"
            >Delete</Button
          >
        </template>
      </Modal>
    </div>
  </div>
</template>
