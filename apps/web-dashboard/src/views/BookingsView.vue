<script setup lang="ts">
import { Search } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AsyncState from "../components/AsyncState.vue";
import BookingSheet from "../components/BookingSheet.vue";
import PageHeader from "../components/PageHeader.vue";
import StatStrip from "../components/StatStrip.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useDirectory } from "../stores/directory";
import { BOOKING_FILTERS, type BookingFilterId, type BookingRow, businessDay, formatMoney, shiftDay } from "../viewmodels/format";

const directory = useDirectory();
const route = useRoute();
const router = useRouter();
const search = ref("");

onMounted(directory.refreshAll);

const filterId = computed<BookingFilterId>({
  get: () => BOOKING_FILTERS.find((f) => f.id === route.query.estado)?.id ?? "proximas",
  set: (estado) => void router.replace({ query: { ...route.query, estado } }),
});

const selectedId = computed(() => {
  const id = Number(route.query.reserva);
  return Number.isInteger(id) && id > 0 ? id : null;
});

function select(id: number | null): void {
  const query = { ...route.query, reserva: id === null ? undefined : String(id) };
  void router.replace({ query });
}

function matches(row: BookingRow, term: string): boolean {
  if (!term) return true;
  const needle = term.replace(/^#/, "").toLocaleLowerCase("es-MX");
  return [String(row.id), row.address, row.staffName, row.offeringName].some((v) => v.toLocaleLowerCase("es-MX").includes(needle));
}

const counts = computed(() =>
  Object.fromEntries(
    BOOKING_FILTERS.map((f) => [f.id, directory.bookingRows.filter((r) => (f.statuses as readonly string[]).includes(r.status)).length]),
  ),
);

const rows = computed(() => {
  const filter = BOOKING_FILTERS.find((f) => f.id === filterId.value)!;
  const statuses = filter.statuses as readonly string[];
  const term = search.value.trim();
  const list = directory.bookingRows.filter((r) => statuses.includes(r.status) && matches(r, term));
  return filter.soonestFirst ? [...list].reverse() : list;
});

const stats = computed(() => {
  const all = directory.bookingRows;
  const today = businessDay(new Date());
  const weekEnd = shiftDay(today, 6);
  const active = (r: BookingRow) => r.status === "confirmed" || r.status === "held" || r.status === "in_progress";
  const todayRows = all.filter((r) => r.day === today && active(r));
  const week = all.filter((r) => r.day >= today && r.day <= weekEnd && active(r));
  const weekIds = new Set(week.map((r) => r.id));
  const raw = directory.bookings.data ?? [];
  const weekValue = raw.filter((b) => weekIds.has(b.id)).reduce((sum, b) => sum + b.price_minor, 0);
  const currency = raw[0]?.currency ?? "MXN";
  const review = all.filter((r) => r.status === "pending_review" || r.status === "disputed").length;
  const held = all.filter((r) => r.status === "held").length;
  return [
    { label: "Hoy", value: String(todayRows.length), hint: `${new Set(todayRows.map((r) => r.staffId)).size} personas trabajando` },
    { label: "Próximos 7 días", value: String(week.length), hint: `${formatMoney(weekValue, currency)} agendados` },
    { label: "Por revisar", value: String(review), hint: "Revisión pendiente o en disputa" },
    { label: "Esperan pago", value: String(held), hint: "Horario apartado sin cobro" },
  ];
});

const emptyText = computed(() =>
  search.value.trim() ? "Ninguna reserva coincide con la búsqueda." : "No hay reservas en este estado.",
);
</script>

<template>
  <PageHeader title="Reservas" />
  <StatStrip v-if="directory.bookings.loaded" :items="stats" />

  <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <Tabs v-model="filterId" class="max-w-full overflow-x-auto">
      <TabsList aria-label="Filtrar por estado">
        <TabsTrigger v-for="f in BOOKING_FILTERS" :key="f.id" :value="f.id" class="px-3">
          {{ f.label }}
          <span class="text-xs text-text-muted tabular-nums">{{ counts[f.id] }}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
    <div class="relative lg:w-72">
      <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
      <Input v-model="search" type="search" class="pl-9" placeholder="Número, dirección o persona" aria-label="Buscar reservas" />
    </div>
  </div>

  <AsyncState
    :loading="directory.bookings.loading"
    :error="directory.bookings.error"
    :empty="rows.length === 0"
    :empty-text="emptyText"
    @retry="directory.refreshAll"
  >
    <div class="grouped">
      <Table>
        <caption class="sr-only">Reservas, selecciona una para ver el detalle</caption>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="hidden w-16 pl-4 text-text-muted sm:table-cell">Núm.</TableHead>
            <TableHead class="pl-4 text-text-muted sm:pl-2">Fecha</TableHead>
            <TableHead class="text-text-muted">Servicio</TableHead>
            <TableHead class="hidden text-text-muted xl:table-cell">Dirección</TableHead>
            <TableHead class="text-text-muted">Estado</TableHead>
            <TableHead class="pr-4 text-right text-text-muted">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="r in rows"
            :key="r.id"
            tabindex="0"
            class="cursor-default border-hairline hover:bg-text/4 focus-visible:bg-text/4 focus-visible:outline-none"
            :data-state="selectedId === r.id ? 'selected' : undefined"
            :aria-label="`Ver reserva ${r.id}`"
            @click="select(r.id)"
            @keydown.enter.prevent="select(r.id)"
            @keydown.space.prevent="select(r.id)"
          >
            <TableCell class="hidden pl-4 text-text-muted tabular-nums sm:table-cell">{{ r.id }}</TableCell>
            <TableCell class="pl-4 tabular-nums sm:pl-2">
              <span class="block font-medium">{{ r.dayLabel }}</span>
              <span class="block text-muted-foreground">{{ r.timeRange }}</span>
            </TableCell>
            <TableCell class="max-w-64">
              <span class="block truncate">{{ r.offeringName }}</span>
              <span class="block truncate text-muted-foreground">{{ r.staffName }}</span>
            </TableCell>
            <TableCell class="hidden max-w-72 truncate text-muted-foreground xl:table-cell">{{ r.address }}</TableCell>
            <TableCell><StatusBadge :tone="r.tone" :label="r.statusLabel" /></TableCell>
            <TableCell class="pr-4 text-right font-medium tabular-nums">{{ r.amount }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </AsyncState>

  <BookingSheet :booking-id="selectedId" @close="select(null)" />
</template>
