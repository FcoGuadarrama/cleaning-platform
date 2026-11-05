<script setup lang="ts">
import { ChevronLeft, ChevronRight, ChevronRight as Disclosure, CircleAlert, CreditCard, MapPinOff } from "@lucide/vue";
import { useIntervalFn, useNow } from "@vueuse/core";
import { computed, onMounted, ref, type Component } from "vue";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import AsyncState from "../components/AsyncState.vue";
import DayAgenda from "../components/DayAgenda.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useDirectory } from "../stores/directory";
import { businessDay, formatDayLong, minutesIntoDay, SCHEDULED_STATUSES, shiftDay } from "../viewmodels/format";

const directory = useDirectory();
const router = useRouter();
const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 30_000) });
const today = computed(() => businessDay(now.value));
const day = ref(businessDay(new Date()));
const isToday = computed(() => day.value === today.value);

onMounted(directory.refreshAll);

const dayRows = computed(() =>
  directory.bookingRows.filter((r) => r.day === day.value && SCHEDULED_STATUSES.has(r.status)),
);

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const summary = computed(() => {
  const total = dayRows.value.length;
  if (total === 0) return isToday.value ? "No hay reservas hoy." : "No hay reservas este día.";
  const live = dayRows.value.filter((r) => r.status === "in_progress").length;
  const people = new Set(dayRows.value.map((r) => r.staffId)).size;
  const parts = [`${plural(total, "reserva", "reservas")} con ${plural(people, "persona", "personas")}`];
  if (live > 0) parts.push(`${live} en curso ahora`);
  return `${parts.join(", ")}.`;
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
      tone: "text-warning",
    });
  const review = count("pending_review") + count("disputed");
  if (review > 0)
    items.push({
      key: "review",
      icon: CircleAlert,
      title: plural(review, "reserva por revisar", "reservas por revisar"),
      detail: "Servicios con revisión pendiente o en disputa.",
      to: "/reservas?estado=revisar",
      tone: "text-danger",
    });
  const held = count("held");
  if (held > 0)
    items.push({
      key: "held",
      icon: CreditCard,
      title: plural(held, "reserva espera pago", "reservas esperan pago"),
      detail: "El horario está apartado hasta que se confirme el cobro.",
      to: "/reservas?estado=proximas",
      tone: "text-text-muted",
    });
  return items;
});

const upcoming = computed(() =>
  directory.bookingRows
    .filter((r) => r.startsAt > now.value.getTime() && (r.status === "confirmed" || r.status === "held"))
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 6),
);

function openBooking(id: number): void {
  void router.push({ path: "/reservas", query: { reserva: id, estado: "todas" } });
}
</script>

<template>
  <PageHeader :title="formatDayLong(day)" :description="directory.bookings.loaded ? summary : undefined">
    <div class="flex items-center gap-1" role="group" aria-label="Cambiar día">
      <Button variant="ghost" size="icon" aria-label="Día anterior" @click="day = shiftDay(day, -1)"><ChevronLeft /></Button>
      <Button variant="outline" size="sm" :disabled="isToday" @click="day = today">Hoy</Button>
      <Button variant="ghost" size="icon" aria-label="Día siguiente" @click="day = shiftDay(day, 1)"><ChevronRight /></Button>
    </div>
  </PageHeader>

  <section aria-labelledby="agenda-title" class="mb-10">
    <h2 id="agenda-title" class="sr-only">Agenda del día</h2>
    <AsyncState
      :loading="directory.bookings.loading"
      :error="directory.bookings.error"
      :empty="false"
      empty-text=""
      :rows="3"
      @retry="directory.refreshAll"
    >
      <DayAgenda :rows="dayRows" :now-minutes="isToday ? minutesIntoDay(now) : null" @select="openBooking" />
      <p class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">
        <span class="inline-flex items-center gap-1.5"><span class="hatched size-3 rounded-sm bg-warning/10 text-warning ring-1 ring-warning/30 ring-inset" />Pago pendiente</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-3 rounded-sm bg-primary/12 ring-1 ring-primary/25 ring-inset" />Confirmada</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-3 rounded-sm bg-primary" />En curso</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-3 rounded-sm bg-success/12 ring-1 ring-success/25 ring-inset" />Completada</span>
      </p>
    </AsyncState>
  </section>

  <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
    <section aria-labelledby="attention-title">
      <h2 id="attention-title" class="title-section mb-3">Pendientes</h2>
      <div v-if="attention.length === 0" class="grouped px-4 py-6 text-muted-foreground">
        Todo al día. No hay registros ni reservas esperando una decisión.
      </div>
      <ul v-else class="grouped">
        <li v-for="item in attention" :key="item.key">
          <RouterLink :to="item.to" class="flex items-center gap-3 px-4 py-3.5 transition-colors duration-100 hover:bg-text/4 active:bg-text/8">
            <component :is="item.icon" class="size-5 shrink-0" :class="item.tone" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block font-medium">{{ item.title }}</span>
              <span class="block text-muted-foreground">{{ item.detail }}</span>
            </span>
            <Disclosure class="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <section aria-labelledby="upcoming-title">
      <h2 id="upcoming-title" class="title-section mb-3">Próximas reservas</h2>
      <div v-if="upcoming.length === 0" class="grouped px-4 py-6 text-muted-foreground">
        No hay reservas confirmadas más adelante.
      </div>
      <ul v-else class="grouped">
        <li v-for="r in upcoming" :key="r.id">
          <button type="button" class="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-100 hover:bg-text/4 active:bg-text/8" @click="openBooking(r.id)">
            <span class="w-24 shrink-0 tabular-nums">
              <span class="block font-medium">{{ r.dayLabel }}</span>
              <span class="block text-muted-foreground">{{ r.timeRange }}</span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ r.offeringName }} con {{ r.staffName }}</span>
              <span class="block truncate text-muted-foreground">{{ r.address }}</span>
            </span>
            <StatusBadge :tone="r.tone" :label="r.statusLabel" class="hidden sm:inline-flex" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
