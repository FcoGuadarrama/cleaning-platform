<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ values: number[] }>();
const W = 96;
const H = 28;
const PAD = 4;

const points = computed(() => {
  const v = props.values;
  if (v.length < 2) return [];
  const max = Math.max(...v);
  const min = Math.min(...v);
  const span = max - min || 1;
  return v.map((value, i) => ({
    x: PAD + (i / (v.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (value - min) / span) * (H - PAD * 2),
  }));
});
const path = computed(() => points.value.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(""));
const last = computed(() => points.value.at(-1));
</script>

<template>
  <svg v-if="last" :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" aria-hidden="true" class="overflow-visible">
    <path :d="path" fill="none" class="stroke-text-muted/45" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <circle :cx="last.x" :cy="last.y" r="4" class="fill-chart stroke-card" stroke-width="2" />
  </svg>
</template>
