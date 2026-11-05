<script setup lang="ts">
import { computed } from "vue";
import { formatDelta } from "../../viewmodels/metrics";
import Sparkline from "./Sparkline.vue";

const props = defineProps<{ label: string; value: string; delta: number | null; trend: number[]; period: string }>();

const deltaClass = computed(() => {
  if (props.delta === null || Math.abs(props.delta) < 0.005) return "text-text-muted";
  return props.delta > 0 ? "text-success" : "text-danger";
});
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3 px-5 py-4">
    <p class="text-text-muted">{{ label }}</p>
    <div class="flex items-end justify-between gap-3">
      <p class="text-[1.75rem] leading-none font-semibold tracking-[-0.02em]">{{ value }}</p>
      <Sparkline :values="trend" />
    </div>
    <p class="text-xs text-text-muted">
      <span class="font-semibold tabular-nums" :class="deltaClass">{{ delta === null ? "Sin comparación" : formatDelta(delta) }}</span>
      vs {{ period }}
    </p>
  </div>
</template>
