<script setup lang="ts">
defineProps<{ items: { label: string; value: string; hint?: string }[] }>();
</script>

<template>
  <section aria-label="Indicadores" class="panel mb-6 grid grid-cols-2 gap-px overflow-hidden bg-hairline lg:grid-cols-4">
    <div v-for="item in items" :key="item.label" class="min-w-0 bg-surface-raised px-5 py-4">
      <p class="truncate text-text-muted">{{ item.label }}</p>
      <p class="mt-1.5 text-2xl leading-tight font-semibold tracking-[-0.02em]">{{ item.value }}</p>
      <p v-if="item.hint" class="mt-0.5 truncate text-xs text-text-muted">{{ item.hint }}</p>
    </div>
  </section>
</template>
