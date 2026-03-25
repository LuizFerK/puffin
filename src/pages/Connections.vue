<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from '../components/Button.vue'
import Modal from '../components/Modal.vue'
import { useConnectionStore } from '../stores/connectionStore'
import type { Connection } from '../stores/types'

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

const COLORS = ['#4ade80', '#facc15', '#38bdf8', '#f87171', '#c084fc', '#fb923c']

function getColor(index: number) {
  return COLORS[index % COLORS.length]
}

onMounted(() => loadConnections())

// Form Logic
const isFormVisible = ref(false)

const emptyFormState = (): Omit<Connection, 'id'> => ({
  name: '',
  group: '',
  host: '',
  port: '',
  database: '',
  username: '',
  password: ''
})

const formData = ref({ ...emptyFormState() })

async function submitForm() {
  if (!formData.value.name || !formData.value.host || formData.value.port === '') {
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
  <div max-w="90%" lg:max-w="50%" xl:max-w="30%" m-auto mt-8 flex flex-col>
    <!-- Header -->
    <header mb-4 flex justify-between items-center gap-4>
      <div>
        <h1 text-xl font-semibold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent>
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
      <Button v-else @click="cancelForm" variant="secondary">
        Cancel
      </Button>
    </header>

    <!-- New Connection Form -->
    <div v-if="isFormVisible" mb-8 rounded-xl border border-gray-800 bg-gray="700/10" shadow-xl>
      <div grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-6 pb-0>
        <!-- Row 1 -->
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Connection Name</label>
          <input v-model="formData.name" type="text" placeholder="e.g. My Production DB" bg-transparent border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-700 transition />
        </div>
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Group (Optional)</label>
          <input v-model="formData.group" type="text" placeholder="e.g. Production" bg-transparent border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-700 transition />
        </div>
        
        <!-- Row 2 -->
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Host</label>
          <input v-model="formData.host" type="text" placeholder="localhost or domain" bg-transparent border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-700 transition />
        </div>
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Port</label>
          <input v-model="formData.port" type="number" placeholder="5432" bg-transparent border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-700 transition />
        </div>

        <!-- Row 3 -->
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Database</label>
          <input v-model="formData.database" type="text" placeholder="postgres" bg-transparent border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-700 transition />
        </div>
        <div flex flex-col gap-1>
        </div> <!-- Empty spacer -->

        <!-- Row 4 -->
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Username</label>
          <input v-model="formData.username" type="text" placeholder="admin" bg-transparent border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-700 transition />
        </div>
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Password</label>
          <input v-model="formData.password" type="password" placeholder="••••••••" bg-transparent border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-700 transition />
        </div>
      </div>
      
      <div mt-6 px-6 py-4 border-t border-gray-800 flex justify-end gap-3>
      <Button @click="cancelForm" variant="secondary">
        Cancel
      </Button>
        <Button @click="submitForm" variant="primary">
          Save Connection
        </Button>
      </div>
    </div>

    <!-- Connection List -->
    <div flex-1 overflow-y-auto pr-2 flex flex-col>
      
      <div v-if="connections.length === 0 && !isFormVisible" flex items-center justify-center flex-col mt-20>
        <div i-lucide-server text-3xl text-gray-800 mb-4></div>
        <p text-gray-500>No connections configured</p>
        <p text-gray-500 text-xs>Click "New Connection" to add one</p>
      </div>

      <div v-for="(conns, groupName) in groupedConnections" :key="groupName" flex flex-col gap-3>
        <!-- Group Header -->
        <div v-if="groupName !== 'Ungrouped'" flex items-center gap-4 mb-1 mt-6>
          <h3 text-xs font-semibold text-gray="400/80" uppercase tracking-widest>{{ groupName }}</h3>
          <div flex-1 h-px bg-gray="800/80"></div>
          <span text-xs text-gray-500 font-medium>{{ conns.length }}</span>
        </div>
        <div v-else mt-6></div>
        
        <!-- Group Cards -->
        <div flex flex-col gap-3 :class="{'border-l border-gray-800/80': groupName !== 'Ungrouped'}">
          <div v-for="conn in conns" :key="conn.id" 
            class="group"
            p-4 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-4
            @click="setActiveConnection(conn.id)"
            :class="{
              'ml-4': groupName !== 'Ungrouped',
              'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]': activeConnectionId === conn.id,
              'bg-transparent border-gray-800/60 hover:bg-gray-800/30 hover:border-gray-700': activeConnectionId !== conn.id
            }">
            <div w-10 h-10 rounded-lg flex items-center justify-center
                 :style="{ color: getColor(connections.indexOf(conn)), backgroundColor: getColor(connections.indexOf(conn)) + '1a' }">
              <div i-lucide-server></div>
            </div>
            
            <div flex-1 flex flex-col>
              <span font-medium text-gray-200 text-base>{{ groupName }} {{ conn.name }}</span>
              <span text-sm text-gray-500 font-mono mt-0.5>{{ conn.host }}:{{ conn.port }}/{{ conn.database }}</span>
            </div>

            <div flex items-center gap-3 mr-2>
              <div opacity-0 group-hover:opacity-100 transition-opacity>
                <Button
                  icon="i-lucide-trash"
                  variant="secondary"
                  class="hover:!text-red-400 hover:!bg-red-500/10 px-2!"
                  @click.stop="openDeleteModal(conn)"
                />
              </div>
              <div transition-colors
                    :class="activeConnectionId === conn.id ? 'text-emerald-500' : 'text-emerald-600/60 group-hover:text-emerald-500/80'">
                <div i-lucide-plug text-sm></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>

    <!-- Delete Confirmation Modal -->
    <Modal :open="isDeleteModalOpen" title="Delete Connection" @close="isDeleteModalOpen = false">
      <p text-sm text-gray-400>
        Are you sure you want to delete
        <span font-semibold text-gray-200>{{ connectionToDelete?.name }}</span>?
        This action cannot be undone.
      </p>
      <template #footer>
        <Button variant="secondary" @click="isDeleteModalOpen = false">Cancel</Button>
        <Button variant="primary" class="!bg-red-500/10 !text-red-400 hover:!bg-red-500/20" @click="confirmDelete">Delete</Button>
      </template>
    </Modal>
  </div>
</template>
