<script setup lang="ts">
import type { Schemas } from "@repo/api-client";
import { onMounted, ref } from "vue";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import UiButton from "../components/UiButton.vue";
import { useResource } from "../useResource";
import { formatMoney, mondayOf } from "../viewmodels/format";

const staff = useResource(() => api.GET("/admin/staff"));
const week = ref(mondayOf(new Date()));
const summaries = ref<Record<number, Schemas["EarningsSummaryOut"]>>({});
const settlements = ref<Record<number, Schemas["SettlementOut"]>>({});
const payoutRef = ref<Record<number, string>>({});
const busy = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  await staff.refresh();
  const entries = await Promise.all(
    (staff.data.value ?? []).map(async (s) => {
      const { data } = await api.GET("/admin/staff/{staff_id}/earnings", {
        params: { path: { staff_id: s.id }, query: { week_start: week.value } },
      });
      return data ? [[s.id, data] as const] : [];
    }),
  );
  summaries.value = Object.fromEntries(entries.flat());
}

async function approve(staffId: number): Promise<void> {
  busy.value = true;
  const { data, error: e } = await api.POST("/admin/settlements", { body: { staff_id: staffId, week_start: week.value } });
  busy.value = false;
  error.value = e ? errorMessage(e) : null;
  if (data) settlements.value[staffId] = data;
  await load();
}

async function pay(staffId: number): Promise<void> {
  const settlement = settlements.value[staffId];
  if (!settlement) return;
  busy.value = true;
  const { data, error: e } = await api.POST("/admin/settlements/{settlement_id}/payout", {
    params: { path: { settlement_id: settlement.id } },
    body: { reference: payoutRef.value[staffId] ?? "" },
  });
  busy.value = false;
  error.value = e ? errorMessage(e) : null;
  if (data) settlements.value[staffId] = data;
  await load();
}

onMounted(load);
</script>

<template>
  <h1 class="mb-2 text-xl font-bold">Liquidaciones semanales</h1>
  <label class="mb-4 block max-w-xs text-sm">Semana (lunes)
    <input v-model="week" type="date" class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" @change="load" />
  </label>
  <p v-if="error" role="alert" class="mb-2 text-sm text-danger">{{ error }}</p>
  <AsyncState :loading="staff.loading.value" :error="staff.error.value" :empty="!staff.data.value?.length" empty-text="No hay personal registrado." @retry="load">
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b border-border"><th scope="col" class="py-2">Persona</th><th scope="col">Generado</th><th scope="col">Aprobado</th><th scope="col">Pagado</th><th scope="col">Acciones</th></tr></thead>
      <tbody>
        <tr v-for="s in staff.data.value ?? []" :key="s.id" class="border-b border-border">
          <td class="py-2">{{ s.display_name }}</td>
          <template v-if="summaries[s.id]">
            <td>{{ formatMoney(summaries[s.id]!.earned_minor, summaries[s.id]!.currency) }}</td>
            <td>{{ formatMoney(summaries[s.id]!.approved_minor, summaries[s.id]!.currency) }}</td>
            <td>{{ formatMoney(summaries[s.id]!.paid_minor, summaries[s.id]!.currency) }}</td>
          </template>
          <td v-else colspan="3" class="text-text-muted">Sin datos</td>
          <td class="flex flex-wrap items-center gap-2 py-2">
            <UiButton :busy="busy" :disabled="!summaries[s.id]?.earned_minor" @click="approve(s.id)">Aprobar semana</UiButton>
            <template v-if="settlements[s.id]?.status === 'approved'">
              <input v-model="payoutRef[s.id]" aria-label="Referencia de pago" placeholder="Referencia" class="min-h-11 rounded-md border border-border bg-background px-3" />
              <UiButton variant="secondary" :busy="busy" :disabled="!payoutRef[s.id]" @click="pay(s.id)">Registrar pago</UiButton>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </AsyncState>
</template>
