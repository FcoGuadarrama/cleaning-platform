<script setup lang="ts">
import { RotateCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

withDefaults(defineProps<{ loading: boolean; error: string | null; empty: boolean; emptyText: string; rows?: number }>(), {
  rows: 4,
});
defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="loading" role="status" aria-live="polite" class="grouped">
    <span class="sr-only">Cargando…</span>
    <div v-for="n in rows" :key="n" class="flex items-center gap-4 px-4 py-3.5">
      <Skeleton class="h-4 w-24" />
      <Skeleton class="h-4 flex-1" />
      <Skeleton class="h-4 w-16" />
    </div>
  </div>
  <div v-else-if="error" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger/8 px-4 py-3 text-danger">
    <p>{{ error }}</p>
    <Button variant="outline" size="sm" @click="$emit('retry')"><RotateCw />Reintentar</Button>
  </div>
  <div v-else-if="empty" class="rounded-lg border border-dashed border-border px-6 py-10 text-center">
    <p class="text-muted-foreground">{{ emptyText }}</p>
    <div v-if="$slots.action" class="mt-4 flex justify-center"><slot name="action" /></div>
  </div>
  <slot v-else />
</template>
