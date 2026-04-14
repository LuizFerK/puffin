<script setup lang="ts">
import FormInput from "./FormInput.vue"
import Button from "../Button.vue"
import type { Connection } from "../../types"

const formData = defineModel<Omit<Connection, "id">>({ required: true })

defineEmits<{
  submit: []
  cancel: []
}>()
</script>

<template>
  <div mb-8 rounded-xl border border-gray-800 bg-gray="700/10" shadow-xl>
    <div grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-6 pb-0>
      <!-- Row 1 -->
      <FormInput
        label="Group"
        v-model="formData.group"
        placeholder="e.g. Capybara"
      />
      <FormInput
        label="Connection Name"
        v-model="formData.name"
        placeholder="e.g. Production"
      />

      <!-- Row 2 -->
      <FormInput
        label="Host"
        v-model="formData.host"
        placeholder="localhost or domain"
      />
      <FormInput
        label="Port"
        v-model="formData.port"
        type="number"
        placeholder="5432"
      />

      <!-- Row 3 -->
      <FormInput
        label="Database"
        v-model="formData.database"
        placeholder="postgres"
      />
      <div flex flex-col gap-1></div>
      <!-- Empty spacer -->

      <FormInput
        label="Username"
        v-model="formData.username"
        placeholder="admin"
      />
      <FormInput
        label="Password"
        v-model="formData.password"
        type="password"
        placeholder="••••••••"
      />
    </div>

    <div mt-6 px-6 py-4 border-t border-gray-800 flex justify-end gap-3>
      <Button @click="$emit('cancel')" variant="secondary"> Cancel </Button>
      <Button @click="$emit('submit')" variant="primary">
        Save Connection
      </Button>
    </div>
  </div>
</template>
