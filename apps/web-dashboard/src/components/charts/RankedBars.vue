<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  items: { key: string | number; label: string; value: number; display: string }[];
  emptyText: string;
}>();
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)));
</script>

<template>
  <p v-if="items.length === 0" class="py-6 text-center text-muted-foreground">{{ emptyText }}</p>
  <ul v-else class="grid gap-3">
    <li v-for="item in items" :key="item.key" class="grid gap-1.5" :title="`${item.label}: ${item.display}`">
      <div class="flex items-baseline justify-between gap-3">
        <span class="truncate">{{ item.label }}</span>
        <span class="font-medium tabular-nums">{{ item.display }}</span>
      </div>
      <div class="h-2 rounded-full bg-text/6" aria-hidden="true">
        <div class="h-full rounded-full bg-chart" :style="{ width: `${(item.value / max) * 100}%` }" />
      </div>
    </li>
  </ul>
</template>
