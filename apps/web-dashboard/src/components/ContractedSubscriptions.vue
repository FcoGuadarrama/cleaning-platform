<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDirectory } from "../stores/directory";
import { SUBSCRIPTION_FILTERS, type SubscriptionFilterId, toSubscriptionRow } from "../viewmodels/contractedSubscriptions";
import AsyncState from "./AsyncState.vue";
import StatusBadge from "./StatusBadge.vue";
import SubscriptionSheet from "./SubscriptionSheet.vue";

const route = useRoute();
const router = useRouter();
const directory = useDirectory();

onMounted(() => {
  void directory.subscriptions.refresh();
  for (const r of [directory.staff, directory.customers]) if (!r.loaded) void r.refresh();
});

function patchQuery(patch: Record<string, string | undefined>): void {
  void router.replace({ query: { ...route.query, ...patch } });
}

const filterId = computed<SubscriptionFilterId>({
  get: () => SUBSCRIPTION_FILTERS.find((f) => f.id === route.query.filtro)?.id ?? "activas",
  set: (id) => patchQuery({ filtro: id === "activas" ? undefined : id }),
});

const all = computed(() => (directory.subscriptions.data ?? []).map((s) => toSubscriptionRow(s, directory.lookups)));

const counts = computed(() =>
  Object.fromEntries(SUBSCRIPTION_FILTERS.map((f) => [f.id, all.value.filter((r) => (f.statuses as readonly string[]).includes(r.status)).length])),
);

const rows = computed(() => {
  const statuses = SUBSCRIPTION_FILTERS.find((f) => f.id === filterId.value)!.statuses as readonly string[];
  return all.value.filter((r) => statuses.includes(r.status));
});

const selected = computed(() => {
  const id = Number(route.query.suscripcion);
  return directory.subscriptions.data?.find((s) => s.id === id) ?? null;
});

function select(id: number | null): void {
  patchQuery({ suscripcion: id === null ? undefined : String(id) });
}

const emptyText = computed(() =>
  all.value.length === 0
    ? "Aún nadie ha contratado un plan. Las contrataciones de la app aparecen aquí."
    : "No hay suscripciones en este estado.",
);
</script>

<template>
  <Tabs v-model="filterId" class="mb-4 max-w-full overflow-x-auto">
    <TabsList aria-label="Filtrar por estado">
      <TabsTrigger v-for="f in SUBSCRIPTION_FILTERS" :key="f.id" :value="f.id" class="px-3">
        {{ f.label }}
        <span class="text-xs text-text-muted tabular-nums">{{ counts[f.id] }}</span>
      </TabsTrigger>
    </TabsList>
  </Tabs>

  <AsyncState
    :loading="directory.subscriptions.loading"
    :error="directory.subscriptions.error"
    :empty="rows.length === 0"
    :empty-text="emptyText"
    @retry="directory.subscriptions.refresh"
  >
    <div class="grouped">
      <Table>
        <caption class="sr-only">Suscripciones contratadas, selecciona una para ver el detalle</caption>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="pl-4">Cliente</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead class="hidden lg:table-cell">Días y hora</TableHead>
            <TableHead class="hidden md:table-cell">Ciclo actual</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead class="pr-4 text-right">Precio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="r in rows"
            :key="r.id"
            tabindex="0"
            class="cursor-default border-hairline hover:bg-text/4 focus-visible:bg-text/4 focus-visible:outline-none"
            :data-state="selected?.id === r.id ? 'selected' : undefined"
            :aria-label="`Ver suscripción de ${r.customerName}`"
            @click="select(r.id)"
            @keydown.enter.prevent="select(r.id)"
            @keydown.space.prevent="select(r.id)"
          >
            <TableCell class="max-w-56 pl-4">
              <span class="block truncate font-medium">{{ r.customerName }}</span>
              <span v-if="r.customerEmail" class="block truncate text-muted-foreground">{{ r.customerEmail }}</span>
            </TableCell>
            <TableCell class="max-w-56">
              <span class="block truncate">{{ r.planName }}</span>
              <span class="block truncate text-muted-foreground">{{ r.staffName }}</span>
            </TableCell>
            <TableCell class="hidden tabular-nums lg:table-cell">{{ r.schedule }}</TableCell>
            <TableCell class="hidden tabular-nums md:table-cell">
              <span class="block">{{ r.cycle }}</span>
              <span class="block text-muted-foreground">
                {{ r.visitsDone }} de {{ r.visitsTotal }} visitas hechas<template v-if="r.renews"> · renueva {{ r.renews }}</template>
              </span>
            </TableCell>
            <TableCell><StatusBadge :tone="r.tone" :label="r.statusLabel" /></TableCell>
            <TableCell class="pr-4 text-right font-medium tabular-nums">{{ r.price }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </AsyncState>

  <SubscriptionSheet :subscription="selected" @close="select(null)" />
</template>
