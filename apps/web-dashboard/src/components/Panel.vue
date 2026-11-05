<script setup lang="ts">
defineProps<{ title?: string; description?: string; flush?: boolean }>();
</script>

<template>
  <section class="panel flex min-w-0 flex-col">
    <header v-if="title || $slots.action" class="flex flex-wrap items-start justify-between gap-3 px-5 pt-4" :class="flush ? 'pb-3' : ''">
      <div class="min-w-0">
        <h2 v-if="title" class="font-semibold tracking-[-0.005em]">{{ title }}</h2>
        <p v-if="description" class="text-xs text-text-muted">{{ description }}</p>
      </div>
      <slot name="action" />
    </header>
    <div :class="flush ? 'border-t border-hairline' : 'px-5 pt-3 pb-5'" class="min-w-0 flex-1">
      <slot />
    </div>
  </section>
</template>
