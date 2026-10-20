<script setup lang="ts">
import type { PgError } from "../../types"
import { capitalize } from "../../helpers/stringHelpers"

defineProps<{
  error: PgError
}>()
</script>

<template>
  <span text-sm text-red-400>{{ capitalize(error.detail) }}</span>
  <span v-if="error.hint" text-xs text-red-500 opacity-70 mt-1>{{ error.hint }}</span>
</template>
