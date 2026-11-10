<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";

defineProps<{ id: string; label: string; options: readonly { value: string; label: string }[]; allLabel: string }>();
const model = defineModel<string>({ required: true });
</script>

<template>
  <div class="grid gap-1">
    <label :for="id" class="text-xs text-text-muted">{{ label }}</label>
    <div class="relative">
      <select
        :id="id"
        v-model="model"
        class="h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      >
        <option value="">{{ allLabel }}</option>
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
    </div>
  </div>
</template>
