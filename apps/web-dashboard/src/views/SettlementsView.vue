<script setup lang="ts">
import type { Schemas } from "@repo/api-client";
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import { computed, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatStrip from "../components/StatStrip.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useDirectory } from "../stores/directory";
import { formatMoney, formatWeekRange, mondayOf, shiftDay } from "../viewmodels/format";

const directory = useDirectory();
const thisWeek = mondayOf(new Date());
const week = ref(thisWeek);
const summaries = ref<Record<number, Schemas["EarningsSummaryOut"]>>({});
const settlements = ref<Record<number, Schemas["SettlementOut"]>>({});
const loadingSummaries = ref(false);
const busyId = ref<number | null>(null);
const error = ref<string | null>(null);
const payingId = ref<number | null>(null);
const payoutRef = ref("");

async function loadSummaries(): Promise<void> {
  loadingSummaries.value = true;
  const entries = await Promise.all(
    (directory.staff.data ?? []).map(async (s) => {
      const { data } = await api.GET("/admin/staff/{staff_id}/earnings", {
        params: { path: { staff_id: s.id }, query: { week_start: week.value } },
      });
      return data ? [[s.id, data] as const] : [];
    }),
  );
  summaries.value = Object.fromEntries(entries.flat());
  loadingSummaries.value = false;
}

async function load(): Promise<void> {
  await directory.staff.refresh();
  await loadSummaries();
}

onMounted(load);
watch(week, () => {
  settlements.value = {};
  void loadSummaries();
});

const currency = computed(() => Object.values(summaries.value)[0]?.currency ?? "MXN");
const totals = computed(() =>
  Object.values(summaries.value).reduce(
    (acc, s) => ({ earned: acc.earned + s.earned_minor, approved: acc.approved + s.approved_minor, paid: acc.paid + s.paid_minor }),
    { earned: 0, approved: 0, paid: 0 },
  ),
);

const stats = computed(() => {
  const pendingPeople = Object.values(summaries.value).filter((s) => s.earned_minor > s.approved_minor).length;
  return [
    { label: "Generado", value: formatMoney(totals.value.earned, currency.value), hint: "Servicios completados en la semana" },
    { label: "Aprobado", value: formatMoney(totals.value.approved, currency.value) },
    { label: "Pagado", value: formatMoney(totals.value.paid, currency.value) },
    { label: "Por aprobar", value: String(pendingPeople), hint: pendingPeople === 1 ? "persona con importe abierto" : "personas con importe abierto" },
  ];
});

const payingName = computed(() => directory.staffById.get(payingId.value ?? -1)?.display_name ?? "");

function canApprove(id: number): boolean {
  const s = summaries.value[id];
  return !!s && s.earned_minor > s.approved_minor;
}

async function approve(staffId: number): Promise<void> {
  busyId.value = staffId;
  const { data, error: e } = await api.POST("/admin/settlements", { body: { staff_id: staffId, week_start: week.value } });
  busyId.value = null;
  error.value = e ? errorMessage(e) : null;
  if (!data) return;
  settlements.value[staffId] = data;
  toast.success(`Semana aprobada para ${directory.staffById.get(staffId)?.display_name ?? "la persona"}`);
  await loadSummaries();
}

async function pay(): Promise<void> {
  const staffId = payingId.value;
  const settlement = staffId === null ? undefined : settlements.value[staffId];
  if (staffId === null || !settlement) return;
  busyId.value = staffId;
  const { data, error: e } = await api.POST("/admin/settlements/{settlement_id}/payout", {
    params: { path: { settlement_id: settlement.id } },
    body: { reference: payoutRef.value.trim() },
  });
  busyId.value = null;
  error.value = e ? errorMessage(e) : null;
  if (!data) return;
  settlements.value[staffId] = data;
  toast.success("Pago registrado");
  payingId.value = null;
  payoutRef.value = "";
  await loadSummaries();
}
</script>

<template>
  <PageHeader title="Liquidaciones" description="Aprueba lo generado en la semana y después registra el pago con su referencia.">
    <div class="flex items-center gap-1" role="group" aria-label="Cambiar semana">
      <Button variant="ghost" size="icon" aria-label="Semana anterior" @click="week = shiftDay(week, -7)"><ChevronLeft /></Button>
      <p class="min-w-44 text-center font-medium tabular-nums" aria-live="polite">{{ formatWeekRange(week) }}</p>
      <Button variant="ghost" size="icon" aria-label="Semana siguiente" @click="week = shiftDay(week, 7)"><ChevronRight /></Button>
      <Button v-if="week !== thisWeek" variant="outline" size="sm" class="ml-1" @click="week = thisWeek">Esta semana</Button>
    </div>
  </PageHeader>

  <StatStrip :items="stats" />

  <p v-if="error" role="alert" class="mb-4 rounded-lg bg-danger/8 px-4 py-3 text-danger">{{ error }}</p>

  <AsyncState
    :loading="directory.staff.loading"
    :error="directory.staff.error"
    :empty="!directory.staff.data?.length"
    empty-text="No hay personal registrado."
    @retry="load"
  >
    <div class="grouped" :aria-busy="loadingSummaries">
      <Table>
        <caption class="sr-only">Importes de la semana del {{ formatWeekRange(week) }} por persona</caption>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="pl-4 text-text-muted">Persona</TableHead>
            <TableHead class="text-right text-text-muted">Generado</TableHead>
            <TableHead class="text-right text-text-muted">Aprobado</TableHead>
            <TableHead class="text-right text-text-muted">Pagado</TableHead>
            <TableHead class="pr-4 text-right text-text-muted"><span class="sr-only">Acciones</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody :class="loadingSummaries ? 'opacity-60 transition-opacity' : 'transition-opacity'">
          <TableRow v-for="s in directory.staff.data ?? []" :key="s.id" class="border-hairline hover:bg-transparent">
            <TableCell class="pl-4 font-medium">{{ s.display_name }}</TableCell>
            <template v-if="summaries[s.id]">
              <TableCell class="text-right tabular-nums">{{ formatMoney(summaries[s.id]!.earned_minor, summaries[s.id]!.currency) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ formatMoney(summaries[s.id]!.approved_minor, summaries[s.id]!.currency) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ formatMoney(summaries[s.id]!.paid_minor, summaries[s.id]!.currency) }}</TableCell>
            </template>
            <TableCell v-else colspan="3" class="text-right text-muted-foreground">Sin datos de la semana</TableCell>
            <TableCell class="pr-4">
              <div class="flex justify-end gap-2">
                <StatusBadge v-if="settlements[s.id]?.status === 'paid'" tone="success" label="Pagada" />
                <Button
                  v-else-if="settlements[s.id]?.status === 'approved'"
                  size="sm"
                  variant="outline"
                  @click="payingId = s.id"
                >Registrar pago</Button>
                <Button
                  v-else
                  size="sm"
                  :variant="canApprove(s.id) ? 'outline' : 'ghost'"
                  :disabled="!canApprove(s.id) || busyId === s.id"
                  :aria-busy="busyId === s.id"
                  @click="approve(s.id)"
                >Aprobar semana</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
        <TableFooter class="bg-transparent">
          <TableRow class="border-hairline hover:bg-transparent">
            <TableCell class="pl-4 font-semibold">Total</TableCell>
            <TableCell class="text-right font-semibold tabular-nums">{{ formatMoney(totals.earned, currency) }}</TableCell>
            <TableCell class="text-right font-semibold tabular-nums">{{ formatMoney(totals.approved, currency) }}</TableCell>
            <TableCell class="text-right font-semibold tabular-nums">{{ formatMoney(totals.paid, currency) }}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  </AsyncState>

  <Dialog :open="payingId !== null" @update:open="(v) => !v && (payingId = null)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle class="title-section">Registrar pago</DialogTitle>
        <DialogDescription>
          {{ payingName }}, semana del {{ formatWeekRange(week) }}
          <template v-if="payingId !== null && settlements[payingId]">
            por {{ formatMoney(settlements[payingId]!.total_minor, settlements[payingId]!.currency) }}
          </template>
        </DialogDescription>
      </DialogHeader>
      <form id="payout-form" class="grid gap-2" @submit.prevent="pay">
        <Label for="payout-ref">Referencia del pago</Label>
        <Input id="payout-ref" v-model="payoutRef" required autocomplete="off" />
      </form>
      <DialogFooter>
        <Button variant="outline" @click="payingId = null">Cancelar</Button>
        <Button type="submit" form="payout-form" :disabled="!payoutRef.trim() || busyId !== null" :aria-busy="busyId !== null">Registrar pago</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
