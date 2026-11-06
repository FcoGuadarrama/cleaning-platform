<script setup lang="ts">
import { ChevronLeft, ChevronRight, CircleAlert, CreditCard, MapPinOff } from "@lucide/vue";
import { useIntervalFn, useNow } from "@vueuse/core";
import { computed, onMounted, ref, type Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AsyncState from "../components/AsyncState.vue";
import ColumnChart from "../components/charts/ColumnChart.vue";
import RankedBars from "../components/charts/RankedBars.vue";
import StatTile from "../components/charts/StatTile.vue";
import DayAgenda from "../components/DayAgenda.vue";
import PageHeader from "../components/PageHeader.vue";
import Panel from "../components/Panel.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useDirectory } from "../stores/directory";
import { businessDay, formatDayLong, formatMoney, minutesIntoDay, SCHEDULED_STATUSES, shiftDay } from "../viewmodels/format";
import { computeMetrics, formatMoneyCompact, RANGES, type RangeId } from "../viewmodels/metrics";

const directory = useDirectory();
const route = useRoute();
const router = useRouter();
const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 30_000) });
const today = computed(() => businessDay(now.value));
const day = ref(businessDay(new Date()));
const isToday = computed(() => day.value === today.value);

onMounted(directory.refreshAll);

const rangeId = computed<RangeId>({
  get: () => RANGES.find((r) => r.id === route.query.rango)?.id ?? "30",
  set: (rango) => void router.replace({ query: { ...route.query, rango } }),
});
const range = computed(() => RANGES.find((r) => r.id === rangeId.value)!);
const metrics = computed(() => computeMetrics(directory.bookings.data ?? [], today.value, rangeId.value));
const currency = computed(() => metrics.value.currency);
const period = computed(() => `los ${range.value.days} días anteriores`);

const money = (minor: number) => formatMoney(minor, currency.value);
const moneyCompact = (minor: number) => formatMoneyCompact(minor, currency.value);
const hours = (h: number) => `${Math.round(h)} h`;

const salesSeries = computed(() => metrics.value.buckets.map((b) => ({ key: b.key, label: b.label, title: b.title, value: b.sales })));
const statusBars = computed(() =>
  metrics.value.byStatus.map((s) => ({ key: s.status, label: s.label, value: s.count, display: String(s.count) })),
);
const statusTotal = computed(() => metrics.value.byStatus.reduce((n, s) => n + s.count, 0));
const staffBars = computed(() =>
  metrics.value.byStaff.map((s) => ({
    key: s.staffId,
    label: directory.lookups.staffName(s.staffId),
    value: s.sales,
    display: money(s.sales),
  })),
);

const dayRows = computed(() =>
  directory.bookingRows.filter((r) => r.day === day.value && SCHEDULED_STATUSES.has(r.status)),
);

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const todaySummary = computed(() => {
  const rows = directory.bookingRows.filter((r) => r.day === today.value && SCHEDULED_STATUSES.has(r.status));
  if (rows.length === 0) return "Sin reservas hoy.";
  const live = rows.filter((r) => r.status === "in_progress").length;
  const people = new Set(rows.map((r) => r.staffId)).size;
  const base = `${plural(rows.length, "reserva", "reservas")} hoy con ${plural(people, "persona", "personas")}`;
  return live > 0 ? `${base}, ${live} en curso ahora.` : `${base}.`;
});

interface Attention {
  key: string;
  icon: Component;
  title: string;
  detail: string;
  to: string;
  tone: string;
}

const attention = computed<Attention[]>(() => {
  const rows = directory.bookingRows;
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const items: Attention[] = [];
  const exceptions = directory.exceptions.data?.length ?? 0;
  if (exceptions > 0)
    items.push({
      key: "exceptions",
      icon: MapPinOff,
      title: plural(exceptions, "registro sin ubicación", "registros sin ubicación"),
      detail: "Apruébalos o recházalos con una nota.",
      to: "/asistencia",
      tone: "bg-warning/14 text-warning",
    });
  const review = count("pending_review") + count("disputed");
  if (review > 0)
    items.push({
      key: "review",
      icon: CircleAlert,
      title: plural(review, "reserva por revisar", "reservas por revisar"),
      detail: "Revisión pendiente o en disputa.",
      to: "/reservas?estado=revisar",
      tone: "bg-danger/12 text-danger",
    });
  const held = count("held");
  if (held > 0)
    items.push({
      key: "held",
      icon: CreditCard,
      title: plural(held, "reserva espera pago", "reservas esperan pago"),
      detail: "El horario queda apartado hasta el cobro.",
      to: "/reservas?estado=proximas",
      tone: "bg-text/8 text-text-muted",
    });
  return items;
});

const upcoming = computed(() =>
  directory.bookingRows
    .filter((r) => r.startsAt > now.value.getTime() && (r.status === "confirmed" || r.status === "held"))
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 5),
);

function openBooking(id: number): void {
  void router.push({ path: "/reservas", query: { reserva: id, estado: "todas" } });
}
</script>

<template>
  <PageHeader title="Resumen" :description="`${formatDayLong(today)}. ${directory.bookings.loaded ? todaySummary : ''}`" />

  <AsyncState
    :loading="directory.bookings.loading"
    :error="directory.bookings.error"
    :empty="false"
    empty-text=""
    :rows="5"
    @retry="directory.refreshAll"
  >
    <div class="grid gap-6">
      <div class="flex flex-wrap items-center gap-3">
        <Tabs v-model="rangeId" class="max-w-full">
          <TabsList aria-label="Periodo">
            <TabsTrigger v-for="r in RANGES" :key="r.id" :value="r.id" class="px-3"><span class="hidden sm:inline">Últimos</span> {{ r.label }}</TabsTrigger>
          </TabsList>
        </Tabs>
        <p class="text-xs text-text-muted">Las cifras comparan con {{ period }}.</p>
      </div>

      <section aria-label="Indicadores" class="panel grid grid-cols-1 gap-px overflow-hidden bg-hairline sm:grid-cols-2 xl:grid-cols-4">
        <StatTile class="bg-surface-raised" label="Ventas confirmadas" :value="moneyCompact(metrics.sales.value)" :delta="metrics.sales.delta" :trend="metrics.sales.trend" :period="period" />
        <StatTile class="bg-surface-raised" label="Reservas" :value="String(metrics.bookings.value)" :delta="metrics.bookings.delta" :trend="metrics.bookings.trend" :period="period" />
        <StatTile class="bg-surface-raised" label="Ticket promedio" :value="money(metrics.avgTicket.value)" :delta="metrics.avgTicket.delta" :trend="metrics.avgTicket.trend" :period="period" />
        <StatTile class="bg-surface-raised" label="Horas de servicio" :value="hours(metrics.hours.value)" :delta="metrics.hours.delta" :trend="metrics.hours.trend" :period="period" />
      </section>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          class="lg:col-span-2"
          :title="range.id === '90' ? 'Ventas por semana' : 'Ventas por día'"
          :description="`Total ${money(metrics.sales.value)} en los últimos ${range.days} días`"
        >
          <ColumnChart
            :items="salesSeries"
            :format-value="money"
            :format-tick="moneyCompact"
            :caption="`Ventas confirmadas, últimos ${range.days} días`"
          />
        </Panel>
        <Panel title="Reservas por estado" :description="`${statusTotal} en el periodo, con canceladas`">
          <RankedBars :items="statusBars" empty-text="Sin reservas en el periodo." />
        </Panel>
      </div>

      <Panel title="Agenda" :description="formatDayLong(day)" flush>
        <template #action>
          <div class="flex items-center gap-1" role="group" aria-label="Cambiar día">
            <Button variant="ghost" size="icon-sm" aria-label="Día anterior" @click="day = shiftDay(day, -1)"><ChevronLeft /></Button>
            <Button variant="outline" size="sm" :disabled="isToday" @click="day = today">Hoy</Button>
            <Button variant="ghost" size="icon-sm" aria-label="Día siguiente" @click="day = shiftDay(day, 1)"><ChevronRight /></Button>
          </div>
        </template>
        <DayAgenda :rows="dayRows" :now-minutes="isToday ? minutesIntoDay(now) : null" embedded @select="openBooking" />
      </Panel>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Pendientes" flush>
          <p v-if="attention.length === 0" class="px-5 py-6 text-muted-foreground">Todo al día.</p>
          <ul v-else class="divide-y divide-hairline">
            <li v-for="item in attention" :key="item.key">
              <RouterLink :to="item.to" class="flex items-center gap-3 px-5 py-3.5 transition-colors duration-100 hover:bg-text/4 active:bg-text/8">
                <span class="grid size-9 shrink-0 place-items-center rounded-lg" :class="item.tone" aria-hidden="true">
                  <component :is="item.icon" class="size-4.5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-medium">{{ item.title }}</span>
                  <span class="block truncate text-muted-foreground">{{ item.detail }}</span>
                </span>
                <ChevronRight class="size-4 shrink-0 text-text-muted" aria-hidden="true" />
              </RouterLink>
            </li>
          </ul>
        </Panel>

        <Panel title="Próximas reservas" flush>
          <p v-if="upcoming.length === 0" class="px-5 py-6 text-muted-foreground">No hay reservas más adelante.</p>
          <ul v-else class="divide-y divide-hairline">
            <li v-for="r in upcoming" :key="r.id">
              <button type="button" class="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-100 hover:bg-text/4 active:bg-text/8" @click="openBooking(r.id)">
                <span class="w-28 shrink-0 whitespace-nowrap tabular-nums">
                  <span class="block font-medium">{{ r.dayLabel }}</span>
                  <span class="block text-xs text-muted-foreground">{{ r.timeRange }}</span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{{ r.offeringName }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{ r.staffName }}</span>
                </span>
                <StatusBadge :tone="r.tone" :label="r.statusLabel" />
              </button>
            </li>
          </ul>
        </Panel>

        <Panel title="Ventas por persona" :description="`Últimos ${range.days} días`" class="lg:col-span-2 xl:col-span-1">
          <RankedBars :items="staffBars" empty-text="Sin ventas en el periodo." />
        </Panel>
      </div>
    </div>
  </AsyncState>
</template>
