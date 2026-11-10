<script setup lang="ts">
import { Search, X } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { type LocationQueryRaw, useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AsyncState from "../components/AsyncState.vue";
import BookingSheet from "../components/BookingSheet.vue";
import FilterSelect from "../components/FilterSelect.vue";
import PageHeader from "../components/PageHeader.vue";
import SortableHead from "../components/SortableHead.vue";
import StatStrip from "../components/StatStrip.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useDirectory } from "../stores/directory";
import {
  BOOKING_SORT_KEYS,
  type BookingFilters,
  type BookingSort,
  type BookingSortKey,
  DEFAULT_BOOKING_SORT,
  activeFilterCount,
  filterBookings,
  nextSort,
  sortBookings,
} from "../viewmodels/bookingTable";
import { BOOKING_FILTERS, type BookingFilterId, type BookingRow, businessDay, formatMoney, shiftDay } from "../viewmodels/format";

const directory = useDirectory();
const route = useRoute();
const router = useRouter();
const search = ref("");

onMounted(directory.refreshAll);

function setQuery(patch: LocationQueryRaw): void {
  void router.replace({ query: { ...route.query, ...patch } });
}

function queryText(name: string): string {
  const value = route.query[name];
  return typeof value === "string" ? value : "";
}

const filterId = computed<BookingFilterId>({
  get: () => BOOKING_FILTERS.find((f) => f.id === route.query.estado)?.id ?? "proximas",
  set: (estado) => setQuery({ estado }),
});

const selectedId = computed(() => {
  const id = Number(route.query.reserva);
  return Number.isInteger(id) && id > 0 ? id : null;
});

function select(id: number | null): void {
  setQuery({ reserva: id === null ? undefined : String(id) });
}

const sort = computed<BookingSort>(() => {
  const key = BOOKING_SORT_KEYS.find((k) => k === route.query.orden);
  if (!key) return DEFAULT_BOOKING_SORT;
  return { key, dir: route.query.dir === "asc" ? "asc" : "desc" };
});

function sortBy(key: BookingSortKey): void {
  const next = nextSort(sort.value, key);
  const isDefault = next.key === DEFAULT_BOOKING_SORT.key && next.dir === DEFAULT_BOOKING_SORT.dir;
  setQuery({ orden: isDefault ? undefined : next.key, dir: isDefault ? undefined : next.dir });
}

/** Two-way binding between a toolbar control and its URL query parameter ("" clears it). */
function queryModel(name: string) {
  return computed({
    get: () => queryText(name),
    set: (value: string) => setQuery({ [name]: value || undefined }),
  });
}

const staffParam = queryModel("persona");
const offeringParam = queryModel("servicio");
const fromParam = queryModel("desde");
const toParam = queryModel("hasta");

const isoDay = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

const filters = computed<BookingFilters>(() => {
  const staffId = Number(staffParam.value);
  return {
    staffId: Number.isInteger(staffId) && staffId > 0 ? staffId : null,
    offeringName: offeringParam.value || null,
    from: isoDay(fromParam.value),
    to: isoDay(toParam.value),
    search: search.value,
  };
});

const filterCount = computed(() => activeFilterCount(filters.value));

function clearFilters(): void {
  search.value = "";
  setQuery({ persona: undefined, servicio: undefined, desde: undefined, hasta: undefined });
}

const staffOptions = computed(() =>
  [...(directory.staff.data ?? [])]
    .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.display_name.localeCompare(b.display_name, "es-MX"))
    .map((s) => ({ value: String(s.id), label: s.is_active ? s.display_name : `${s.display_name} (inactiva)` })),
);

/** Price changes create new offering versions with the same name, so the filter groups them by name. */
const offeringOptions = computed(() =>
  [...new Set((directory.offerings.data ?? []).map((o) => o.name))]
    .sort((a, b) => a.localeCompare(b, "es-MX"))
    .map((name) => ({ value: name, label: name })),
);

/** Rows that pass the toolbar filters; the status tabs count and split these. */
const filtered = computed(() => filterBookings(directory.bookingRows, filters.value));

const counts = computed(() =>
  Object.fromEntries(
    BOOKING_FILTERS.map((f) => [f.id, filtered.value.filter((r) => (f.statuses as readonly string[]).includes(r.status)).length]),
  ),
);

const rows = computed(() => {
  const statuses = BOOKING_FILTERS.find((f) => f.id === filterId.value)!.statuses as readonly string[];
  return sortBookings(
    filtered.value.filter((r) => statuses.includes(r.status)),
    sort.value,
  );
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

const headProps = computed(() => ({ sortKey: sort.value.key, sortDir: sort.value.dir }));

const emptyText = computed(() =>
  search.value.trim() || filterCount.value > 0 ? "Ninguna reserva coincide con los filtros." : "No hay reservas en este estado.",
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
      <Input v-model="search" type="search" class="pl-9" placeholder="Número, cliente, dirección o persona" aria-label="Buscar reservas" />
    </div>
  </div>

  <div role="group" aria-label="Filtros de reservas" class="mb-4 grid grid-cols-2 items-end gap-3 md:grid-cols-[repeat(4,minmax(0,12rem))_auto]">
    <FilterSelect id="filter-staff" v-model="staffParam" label="Persona" all-label="Todas" :options="staffOptions" />
    <FilterSelect id="filter-offering" v-model="offeringParam" label="Servicio" all-label="Todos" :options="offeringOptions" />
    <div class="grid gap-1">
      <label for="filter-from" class="text-xs text-text-muted">Desde</label>
      <Input id="filter-from" v-model="fromParam" type="date" :max="toParam || undefined" class="tabular-nums" />
    </div>
    <div class="grid gap-1">
      <label for="filter-to" class="text-xs text-text-muted">Hasta</label>
      <Input id="filter-to" v-model="toParam" type="date" :min="fromParam || undefined" class="tabular-nums" />
    </div>
    <Button v-if="filterCount > 0 || search.trim()" variant="ghost" class="col-span-2 justify-self-start md:col-span-1" @click="clearFilters">
      <X />Quitar filtros
    </Button>
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
            <SortableHead v-bind="headProps" column="numero" label="Núm." class="hidden w-20 pl-4 sm:table-cell" @sort="sortBy" />
            <SortableHead v-bind="headProps" column="fecha" label="Fecha" class="pl-4 sm:pl-2" @sort="sortBy" />
            <SortableHead v-bind="headProps" column="servicio" label="Servicio" @sort="sortBy" />
            <SortableHead v-bind="headProps" column="cliente" label="Cliente" class="hidden lg:table-cell" @sort="sortBy" />
            <SortableHead v-bind="headProps" column="direccion" label="Dirección" class="hidden xl:table-cell" @sort="sortBy" />
            <SortableHead v-bind="headProps" column="estado" label="Estado" @sort="sortBy" />
            <SortableHead v-bind="headProps" column="importe" label="Importe" align="right" class="pr-4 text-right" @sort="sortBy" />
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
            <TableCell class="hidden max-w-56 lg:table-cell">
              <span class="block truncate">{{ r.customerName }}</span>
              <span v-if="r.customerEmail" class="block truncate text-muted-foreground">{{ r.customerEmail }}</span>
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
