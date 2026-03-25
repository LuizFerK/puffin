<script setup lang="ts">
import { ref } from "vue";
import SqlHighlighter from "../SqlHighlighter.vue";

defineProps<{
  modelValue: string;
  height: number;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();

const lineNumbersArea = ref<HTMLElement | null>(null);
const highlighterArea = ref<HTMLElement | null>(null);

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (lineNumbersArea.value) {
    lineNumbersArea.value.scrollTop = target.scrollTop;
  }
  if (highlighterArea.value) {
    highlighterArea.value.scrollTop = target.scrollTop;
    highlighterArea.value.scrollLeft = target.scrollLeft;
  }
};

const lines = ref(Array.from({ length: 150 }, (_, i) => i + 1));
</script>

<template>
  <div
    flex
    :style="{ height: height + 'px' }"
    shrink-0
    bg="[#0d1117]"
    overflow-hidden
  >
    <!-- Line Numbers -->
    <div
      ref="lineNumbersArea"
      w-10
      py-4
      text-right
      pr-3
      font-mono
      text-xs
      text-gray-700
      select-none
      overflow-hidden
    >
      <div v-for="n in lines" :key="n" leading-6>{{ n }}</div>
    </div>
    <!-- Textarea & Highlighter Container -->
    <div relative flex-1 overflow-hidden>
      <div
        absolute
        inset-0
        overflow-hidden
        pointer-events-none
        ref="highlighterArea"
      >
        <SqlHighlighter
          :sql="modelValue"
          font-mono
          p-4
          pl-0
          text-sm
          leading-6
          whitespace-pre
        />
      </div>
      <textarea
        :value="modelValue"
        @input="
          $emit(
            'update:modelValue',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
        @scroll="handleScroll"
        absolute
        inset-0
        w-full
        h-full
        bg-transparent
        text-transparent
        caret-white
        font-mono
        p-4
        pl-0
        text-sm
        leading-6
        resize-none
        outline-none
        whitespace-pre
        overflow-auto
        spellcheck="false"
      ></textarea>
    </div>
  </div>
</template>
