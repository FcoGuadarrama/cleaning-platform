<script setup lang="ts">
defineProps<{ loading: boolean; error: string | null; empty: boolean; emptyText: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="loading" role="status" aria-live="polite" class="p-6 text-text-muted">Cargando…</div>
  <div v-else-if="error" role="alert" class="rounded-md border border-danger p-4 text-danger">
    <p>{{ error }}</p>
    <button type="button" class="mt-2 underline" @click="$emit('retry')">Reintentar</button>
  </div>
  <p v-else-if="empty" class="p-6 text-text-muted">{{ emptyText }}</p>
  <slot v-else />
</template>
