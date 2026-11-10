<script setup lang="ts" generic="K extends string">
import { ArrowDown, ArrowUp, ArrowUpDown } from "@lucide/vue";
import { computed, type HTMLAttributes } from "vue";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDir } from "../viewmodels/bookingTable";

const props = defineProps<{
  column: K;
  label: string;
  sortKey: K;
  sortDir: SortDir;
  align?: "left" | "right";
  class?: HTMLAttributes["class"];
}>();
const emit = defineEmits<{ sort: [column: K] }>();

const active = computed(() => props.sortKey === props.column);
const ariaSort = computed(() => (active.value ? (props.sortDir === "asc" ? "ascending" : "descending") : "none"));
</script>

<template>
  <TableHead :aria-sort="ariaSort" :class="cn('text-text-muted', props.class)">
    <button
      type="button"
      :class="
        cn(
          'group -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium outline-none hover:text-text focus-visible:ring-3 focus-visible:ring-ring/50',
          active && 'text-text',
          align === 'right' && 'flex-row-reverse',
        )
      "
      @click="emit('sort', column)"
    >
      {{ label }}
      <ArrowUp v-if="active && sortDir === 'asc'" class="size-3.5" aria-hidden="true" />
      <ArrowDown v-else-if="active" class="size-3.5" aria-hidden="true" />
      <ArrowUpDown v-else class="size-3.5 opacity-40 group-hover:opacity-100" aria-hidden="true" />
    </button>
  </TableHead>
</template>
