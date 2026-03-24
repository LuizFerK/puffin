<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from '../components/Button.vue'

interface Connection {
  id: string
  name: string
  group?: string
  host: string
  port: number | ''
  database: string
  username: string
  password?: string
  color?: string
}

// Mock Data
const connections = ref<Connection[]>([
  { id: '1', name: 'Production DB', group: 'PRODUCTION', host: 'db.production.example.com', port: 5432, database: 'app_production', username: 'admin', color: 'emerald' },
  { id: '2', name: 'Staging DB', group: 'DEVELOPMENT', host: 'db.staging.example.com', port: 5432, database: 'app_staging', username: 'staging_user', color: 'yellow' },
  { id: '3', name: 'Dev DB', group: 'DEVELOPMENT', host: 'localhost', port: 5432, database: 'app_dev', username: 'postgres', color: 'blue' },
  { id: '4', name: 'Analytics DB', host: 'analytics.example.com', port: 5432, database: 'analytics', username: 'admin', color: 'purple' }
])

// Grouping Logic
const groupedConnections = computed(() => {
  const groups: Record<string, Connection[]> = {}
  
  connections.value.forEach(conn => {
    const groupName = conn.group && conn.group.trim() !== '' ? conn.group : 'Ungrouped'
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(conn)
  })

  // Sort groups so 'Ungrouped' appears last or first depending on preference
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Ungrouped') return 1
    if (b === 'Ungrouped') return -1
    return a.localeCompare(b)
  })

  const sortedGroups: Record<string, Connection[]> = {}
  sortedKeys.forEach(k => {
    sortedGroups[k] = groups[k]
  })

  return sortedGroups
})

// Active Connection state
const activeConnectionId = ref<string | null>('2')

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

function submitForm() {
  if (!formData.value.name || !formData.value.host || formData.value.port === '') {
    alert("Please fill in at least the Name, Host, and Port.")
    return
  }
  
  connections.value.push({
    id: Date.now().toString(),
    ...formData.value,
    port: Number(formData.value.port)
  })
  
  // reset form
  formData.value = { ...emptyFormState() }
  isFormVisible.value = false
}

function cancelForm() {
  formData.value = { ...emptyFormState() }
  isFormVisible.value = false
}
</script>

<template>
  <div w="50%" m-auto mt-8 flex flex-col>
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
          <input v-model="formData.name" type="text" placeholder="e.g. My Production DB" bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition />
        </div>
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Group (Optional)</label>
          <input v-model="formData.group" type="text" placeholder="e.g. Production" bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition />
        </div>
        
        <!-- Row 2 -->
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Host</label>
          <input v-model="formData.host" type="text" placeholder="localhost or domain" bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition />
        </div>
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Port</label>
          <input v-model="formData.port" type="number" placeholder="5432" bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition />
        </div>

        <!-- Row 3 -->
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Database</label>
          <input v-model="formData.database" type="text" placeholder="postgres" bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition />
        </div>
        <div flex flex-col gap-1>
        </div> <!-- Empty spacer -->

        <!-- Row 4 -->
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Username</label>
          <input v-model="formData.username" type="text" placeholder="admin" bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition />
        </div>
        <div flex flex-col gap-1>
          <label text-sm text-gray-400 font-medium>Password</label>
          <input v-model="formData.password" type="password" placeholder="••••••••" bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition />
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
      
      <div v-if="connections.length === 0 && !isFormVisible" flex items-center justify-center flex-col gap-4 mt-12>
        <div i-lucide-database text-6xl text-gray-800></div>
        <p text-xl text-gray-500>No active connections</p>
        <Button @click="isFormVisible = true" variant="primary" mt-2 text-sm>Create your first connection</Button>
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
            p-4 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-4 group
            @click="activeConnectionId = conn.id"
            :class="{
              'ml-4': groupName !== 'Ungrouped',
              'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]': activeConnectionId === conn.id,
              'bg-transparent border-gray-800/60 hover:bg-gray-800/30 hover:border-gray-700': activeConnectionId !== conn.id
            }">
            
            <div w-10 h-10 rounded-lg flex items-center justify-center 
                 :class="[
                   conn.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' : '',
                   conn.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-500' : '',
                   conn.color === 'blue' ? 'bg-blue-500/10 text-blue-500' : '',
                   conn.color === 'purple' ? 'bg-purple-500/10 text-purple-500' : '',
                   !conn.color ? 'bg-gray-500/10 text-gray-400' : ''
                 ]">
              <div i-lucide-server></div>
            </div>
            
            <div flex-1 flex flex-col>
              <span font-medium text-gray-200 text-base>{{ conn.name }}</span>
              <span text-sm text-gray-500 font-mono mt-0.5>{{ conn.host }}:{{ conn.port }}/{{ conn.database }}</span>
            </div>
            
            <div flex items-center gap-3 px-2 transition-colors
                 :class="activeConnectionId === conn.id ? 'text-emerald-500' : 'text-emerald-600/60 group-hover:text-emerald-500/80'">
               <div v-if="conn.name.includes('Production') || conn.name.includes('Analytics')" i-lucide-shield text-sm></div>
               <div i-lucide-plug text-sm></div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>
