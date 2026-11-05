<script setup lang="ts">
import { computed, ref } from "vue";
import { niceTicks } from "../../viewmodels/metrics";

const props = defineProps<{
  items: { key: string; label: string; title: string; value: number }[];
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  caption: string;
}>();

const H = 200;
const active = ref<number | null>(null);
const ticks = computed(() => niceTicks(Math.max(0, ...props.items.map((i) => i.value))));
const top = computed(() => ticks.value.at(-1) || 1);
const labelEvery = computed(() => Math.ceil(props.items.length / 7));
const tooltip = computed(() => (active.value === null ? null : props.items[active.value]));
</script>

<template>
  <div class="relative">
    <div class="flex gap-3">
      <div class="relative w-12 shrink-0 text-right text-xs text-text-muted tabular-nums" :style="{ height: `${H}px` }" aria-hidden="true">
        <span v-for="t in ticks" :key="t" class="absolute right-0 -translate-y-1/2" :style="{ top: `${(1 - t / top) * 100}%` }">{{ formatTick(t) }}</span>
      </div>
      <div class="relative min-w-0 flex-1">
        <div class="pointer-events-none absolute inset-x-0 top-0" :style="{ height: `${H}px` }" aria-hidden="true">
          <span v-for="t in ticks" :key="t" class="absolute inset-x-0 h-px bg-hairline" :style="{ top: `${(1 - t / top) * 100}%` }" />
        </div>
        <ol class="relative flex items-end" :style="{ height: `${H}px` }" @pointerleave="active = null">
          <li
            v-for="(item, i) in items"
            :key="item.key"
            class="group flex h-full flex-1 cursor-default items-end justify-center outline-none"
            tabindex="0"
            :aria-label="`${item.title}: ${formatValue(item.value)}`"
            @pointerenter="active = i"
            @focus="active = i"
            @blur="active = null"
          >
            <span
              class="w-[70%] max-w-6 rounded-t-[4px] bg-chart transition-opacity duration-100 group-focus-visible:ring-2 group-focus-visible:ring-ring"
              :class="active !== null && active !== i ? 'opacity-45' : ''"
              :style="{ height: item.value > 0 ? `max(2px, ${(item.value / top) * 100}%)` : '0' }"
            />
          </li>
        </ol>
        <div class="relative mt-2 h-4 text-xs text-text-muted tabular-nums" aria-hidden="true">
          <template v-for="(item, i) in items" :key="item.key">
            <span
              v-if="i % labelEvery === 0"
              class="absolute -translate-x-1/2 whitespace-nowrap"
              :style="{ left: `${((i + 0.5) / items.length) * 100}%` }"
            >{{ item.label }}</span>
          </template>
        </div>
        <div
          v-if="tooltip && active !== null"
          class="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-popover px-2.5 py-1.5 text-xs shadow-2 ring-1 ring-hairline"
          :style="{ left: `${((active + 0.5) / items.length) * 100}%`, top: `${(1 - tooltip.value / top) * H - 44}px` }"
          role="status"
        >
          <p class="font-semibold tabular-nums">{{ formatValue(tooltip.value) }}</p>
          <p class="text-text-muted">{{ tooltip.title }}</p>
        </div>
      </div>
    </div>
    <table class="sr-only">
      <caption>{{ caption }}</caption>
      <tbody>
        <tr v-for="item in items" :key="item.key"><th scope="row">{{ item.title }}</th><td>{{ formatValue(item.value) }}</td></tr>
      </tbody>
    </table>
  </div>
</template>
