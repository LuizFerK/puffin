<script setup lang="ts">
import { computed } from "vue"
import { useSettingsStore } from "../stores/settingsStore"

const props = defineProps<{
  sql: string
  class?: string
}>()

const { syntaxColors } = useSettingsStore()

const KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "and",
  "or",
  "not",
  "in",
  "is",
  "null",
  "as",
  "on",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "cross",
  "full",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "drop",
  "alter",
  "table",
  "index",
  "view",
  "grant",
  "revoke",
  "begin",
  "commit",
  "rollback",
  "having",
  "group",
  "by",
  "order",
  "asc",
  "desc",
  "limit",
  "offset",
  "distinct",
  "union",
  "all",
  "exists",
  "between",
  "like",
  "ilike",
  "case",
  "when",
  "then",
  "else",
  "end",
  "cast",
  "with",
  "recursive",
  "returning",
  "true",
  "false",
  "primary",
  "key",
  "references",
  "foreign",
  "constraint",
  "default",
  "unique",
  "check",
  "cascade",
])

const FUNCTIONS = new Set([
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "coalesce",
  "nullif",
  "now",
  "current_timestamp",
  "lower",
  "upper",
  "trim",
  "length",
  "substring",
  "replace",
  "concat",
  "array_agg",
  "json_agg",
  "jsonb_agg",
  "row_number",
  "rank",
  "dense_rank",
  "gen_random_uuid",
])

const TYPES = new Set([
  "int",
  "integer",
  "bigint",
  "smallint",
  "serial",
  "bigserial",
  "text",
  "varchar",
  "char",
  "boolean",
  "bool",
  "date",
  "timestamp",
  "timestamptz",
  "uuid",
  "json",
  "jsonb",
  "numeric",
  "decimal",
  "real",
  "float",
  "double",
])

function tokenize(sql: string) {
  const tokens: { type: string; value: string }[] = []
  let i = 0

  while (i < sql.length) {
    if (/\s/.test(sql[i])) {
      let start = i
      while (i < sql.length && /\s/.test(sql[i])) i++
      tokens.push({ type: "ws", value: sql.slice(start, i) })
      continue
    }

    if (sql[i] === "-" && sql[i + 1] === "-") {
      let start = i
      while (i < sql.length && sql[i] !== "\n") i++
      tokens.push({ type: "comment", value: sql.slice(start, i) })
      continue
    }

    if (sql[i] === "/" && sql[i + 1] === "*") {
      let start = i
      i += 2
      while (i < sql.length - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) i++
      i += 2
      tokens.push({ type: "comment", value: sql.slice(start, i) })
      continue
    }

    if (sql[i] === "'") {
      let start = i
      i++
      while (i < sql.length && sql[i] !== "'") i++
      if (i < sql.length) i++
      tokens.push({ type: "string", value: sql.slice(start, i) })
      continue
    }

    if (sql[i] === '"') {
      let start = i
      i++
      while (i < sql.length && sql[i] !== '"') i++
      if (i < sql.length) i++
      tokens.push({ type: "string", value: sql.slice(start, i) })
      continue
    }

    if (/\d/.test(sql[i])) {
      let start = i
      while (i < sql.length && /[\d.]/.test(sql[i])) i++
      tokens.push({ type: "number", value: sql.slice(start, i) })
      continue
    }

    if (/[a-zA-Z_]/.test(sql[i])) {
      let start = i
      while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) i++
      const word = sql.slice(start, i)
      const lower = word.toLowerCase()
      if (KEYWORDS.has(lower)) tokens.push({ type: "keyword", value: word })
      else if (FUNCTIONS.has(lower))
        tokens.push({ type: "function", value: word })
      else if (TYPES.has(lower)) tokens.push({ type: "type", value: word })
      else tokens.push({ type: "ident", value: word })
      continue
    }

    tokens.push({ type: "punct", value: sql[i] })
    i++
  }

  return tokens
}

const colorMap = computed<Record<string, string>>(() => ({
  ...syntaxColors.value,
  ws: "transparent",
}))

const highlightedTokens = computed(() => tokenize(props.sql || ""))

function getTokenStyle(type: string) {
  const color = colorMap.value[type] || colorMap.value.ident
  if (type === "comment") return { color, fontStyle: "italic" }
  if (type === "keyword") return { color, fontWeight: 600 }
  return { color }
}
</script>

<template>
  <pre
    :class="props.class"
    style="margin: 0"
  ><template v-for="tok in highlightedTokens" :key="tok.value + Math.random()"><span :style="getTokenStyle(tok.type)">{{ tok.value }}</span></template></pre>
</template>
