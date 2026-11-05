<script setup lang="ts">
import { computed } from "vue";
import type { BookingRow } from "../viewmodels/format";

const props = defineProps<{
  rows: BookingRow[];
  /** Minutes since midnight when the agenda shows today; otherwise null. */
  nowMinutes: number | null;
}>();
defineEmits<{ select: [id: number] }>();

// Presentation window only: wide enough for a working day, stretched to fit any booking outside it.
const DEFAULT_START = 7 * 60;
const DEFAULT_END = 20 * 60;

const range = computed(() => {
  const starts = props.rows.map((r) => r.startMinutes);
  const ends = props.rows.map((r) => r.endMinutes);
  const start = Math.floor(Math.min(DEFAULT_START, ...starts) / 60) * 60;
  const end = Math.ceil(Math.max(DEFAULT_END, ...ends) / 60) * 60;
  return { start, end, span: end - start };
});

const hours = computed(() => {
  const list: number[] = [];
  for (let m = range.value.start; m <= range.value.end; m += 60) list.push(m);
  return list;
});

function pct(minutes: number): number {
  return ((minutes - range.value.start) / range.value.span) * 100;
}

const lanes = computed(() => {
  const byStaff = new Map<number, { name: string; rows: BookingRow[] }>();
  for (const row of props.rows) {
    const lane = byStaff.get(row.staffId) ?? { name: row.staffName, rows: [] };
    lane.rows.push(row);
    byStaff.set(row.staffId, lane);
  }
  return [...byStaff.entries()]
    .map(([id, lane]) => ({ id, ...lane, rows: lane.rows.sort((a, b) => a.startMinutes - b.startMinutes) }))
    .sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
});

const nowPct = computed(() => {
  const now = props.nowMinutes;
  if (now === null || now < range.value.start || now > range.value.end) return null;
  return pct(now);
});

const nowLabel = computed(() => {
  const now = props.nowMinutes ?? 0;
  return `${String(Math.floor(now / 60)).padStart(2, "0")}:${String(now % 60).padStart(2, "0")}`;
});

const BLOCK_TONES: Record<BookingRow["status"], string> = {
  held: "bg-warning/10 text-warning ring-warning/30 hatched",
  confirmed: "bg-primary/12 text-primary ring-primary/25",
  in_progress: "bg-primary text-on-primary ring-primary",
  pending_review: "bg-warning/14 text-warning ring-warning/30",
  completed: "bg-success/12 text-success ring-success/25",
  disputed: "bg-danger/12 text-danger ring-danger/30",
  cancelled: "bg-text/6 text-text-muted ring-border",
  expired: "bg-text/6 text-text-muted ring-border",
};

function hourLabel(m: number): string {
  return `${m / 60}:00`;
}
</script>

<template>
  <div class="grouped">
    <div v-if="lanes.length === 0" class="px-6 py-10 text-center text-muted-foreground">
      Sin reservas para este día.
    </div>
    <div v-else class="overflow-x-auto overscroll-x-contain">
      <div class="relative min-w-[44rem]">
        <div class="flex h-9 items-end border-b border-hairline" aria-hidden="true">
          <div class="w-40 shrink-0" />
          <div class="relative h-full flex-1">
            <span
              v-for="(m, i) in hours"
              :key="m"
              class="absolute bottom-2 text-xs text-text-muted tabular-nums"
              :class="i === 0 ? '' : i === hours.length - 1 ? '-translate-x-full' : '-translate-x-1/2'"
              :style="{ left: `${pct(m)}%` }"
            >{{ hourLabel(m) }}</span>
          </div>
        </div>

        <ul aria-label="Reservas por persona">
          <li v-for="lane in lanes" :key="lane.id" class="flex h-16 border-b border-hairline last:border-b-0">
            <div class="flex w-40 shrink-0 flex-col justify-center px-4">
              <span class="truncate font-medium">{{ lane.name }}</span>
              <span class="text-xs text-text-muted tabular-nums">
                {{ lane.rows.length === 1 ? "1 reserva" : `${lane.rows.length} reservas` }}
              </span>
            </div>
            <div class="relative flex-1">
              <span
                v-for="m in hours.slice(1, -1)"
                :key="m"
                class="absolute inset-y-0 w-px bg-hairline"
                :style="{ left: `${pct(m)}%` }"
                aria-hidden="true"
              />
              <button
                v-for="row in lane.rows"
                :key="row.id"
                type="button"
                class="absolute inset-y-2 flex min-w-0 flex-col justify-center overflow-hidden rounded-md px-2 text-left ring-1 ring-inset transition-transform duration-100 ease-out active:scale-[0.97]"
                :class="BLOCK_TONES[row.status]"
                :style="{ left: `${pct(row.startMinutes)}%`, width: `max(${pct(row.endMinutes) - pct(row.startMinutes)}%, 2.5rem)` }"
                :aria-label="`Reserva ${row.id}, ${row.timeRange}, ${row.offeringName}, ${row.statusLabel}`"
                :title="`${row.timeRange} ${row.offeringName}\n${row.address}\n${row.statusLabel}`"
                @click="$emit('select', row.id)"
              >
                <span class="truncate text-xs font-semibold tabular-nums">{{ row.timeRange }}</span>
                <span class="truncate text-xs opacity-85">{{ row.offeringName }}</span>
              </button>
            </div>
          </li>
        </ul>

        <div v-if="nowPct !== null" class="pointer-events-none absolute top-0 bottom-0 left-40 right-0" aria-hidden="true">
          <div class="absolute top-0 bottom-0 w-px bg-danger" :style="{ left: `${nowPct}%` }">
            <span class="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-on-danger tabular-nums">
              {{ nowLabel }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
