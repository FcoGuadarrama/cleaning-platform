<script setup lang="ts">
import { Banknote, Check, X } from "@lucide/vue";
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import PageHeader from "../components/PageHeader.vue";
import { useDirectory } from "../stores/directory";
import { toTransferRow } from "../viewmodels/transfers";

const directory = useDirectory();
const notes = reactive<Record<number, string>>({});
const busyId = ref<number | null>(null);
const errors = reactive<Record<number, string | null>>({});

onMounted(async () => {
  await Promise.all([directory.transfers.refresh(), directory.customers.refresh()]);
});

const rows = computed(() => (directory.transfers.data ?? []).map((t) => toTransferRow(t, directory.lookups)));

/** A rejection tells the customer why; a confirmation's note is optional. */
const rejectable = (id: number) => (notes[id] ?? "").trim().length >= 3;

async function review(id: number, confirm: boolean): Promise<void> {
  busyId.value = id;
  const note = (notes[id] ?? "").trim();
  const { error: e } = confirm
    ? await api.POST("/admin/payments/{payment_id}/confirm-transfer", { params: { path: { payment_id: id } }, body: { note: note || null } })
    : await api.POST("/admin/payments/{payment_id}/reject-transfer", { params: { path: { payment_id: id } }, body: { note } });
  busyId.value = null;
  errors[id] = e ? errorMessage(e) : null;
  if (e) return;
  toast.success(confirm ? "Transferencia confirmada" : "Transferencia rechazada");
  await Promise.all([directory.transfers.refresh(), directory.bookings.refresh(), directory.subscriptions.refresh()]);
}
</script>

<template>
  <PageHeader
    title="Transferencias"
    description="Pagos por SPEI que esperan confirmación. Busca el depósito por su concepto y monto en el estado de cuenta; cada decisión queda en el registro de auditoría."
  />

  <AsyncState
    :loading="directory.transfers.loading"
    :error="directory.transfers.error"
    :empty="!rows.length"
    empty-text="No hay transferencias por confirmar."
    :rows="2"
    @retry="directory.transfers.refresh()"
  >
    <ul class="grid gap-4">
      <li v-for="r in rows" :key="r.id" class="grouped">
        <div class="flex items-start gap-3 px-4 pt-4 pb-3">
          <Banknote class="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="font-medium">
              {{ r.amount }} · concepto <span class="font-mono tracking-wide">{{ r.reference }}</span>
            </p>
            <p class="truncate text-muted-foreground">
              {{ r.customerName }}<template v-if="r.customerEmail"> ({{ r.customerEmail }})</template> ·
              <RouterLink :to="r.target.to" class="hover:underline">{{ r.target.label }}</RouterLink> · pedido el {{ r.requestedAt }}
            </p>
          </div>
          <Badge v-if="r.payBy" variant="warning" class="hidden sm:inline-flex">Aparta hasta {{ r.payBy }}</Badge>
          <Badge v-else variant="outline" class="hidden sm:inline-flex">Apartado vencido</Badge>
        </div>
        <p v-if="!r.payBy" class="px-4 pb-2 text-warning">
          El apartado ya venció: si confirmas, el pago queda registrado y marcado para reembolso; no se reserva nada.
        </p>
        <form class="grid gap-3 px-4 pt-3 pb-4" @submit.prevent>
          <div class="grid gap-2">
            <Label :for="`note-${r.id}`">Nota</Label>
            <Textarea
              :id="`note-${r.id}`"
              v-model="notes[r.id]"
              rows="2"
              maxlength="500"
              placeholder="Para rechazar, explica qué no coincidió"
            />
          </div>
          <p v-if="errors[r.id]" role="alert" class="text-danger">{{ errors[r.id] }}</p>
          <div class="flex flex-wrap gap-2">
            <Button :disabled="busyId === r.id" :aria-busy="busyId === r.id" @click="review(r.id, true)">
              <Check />Confirmar depósito
            </Button>
            <Button variant="outline" class="text-danger" :disabled="busyId === r.id || !rejectable(r.id)" @click="review(r.id, false)">
              <X />Rechazar
            </Button>
          </div>
        </form>
      </li>
    </ul>
  </AsyncState>
</template>
