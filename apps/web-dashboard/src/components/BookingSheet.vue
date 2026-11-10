<script setup lang="ts">
import type { Schemas } from "@repo/api-client";
import { computed, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "../api";
import { useDirectory } from "../stores/directory";
import { CANCELLABLE_STATUSES, formatDateTime, fromBusinessWallTime, toBusinessWallTime } from "../viewmodels/format";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{ bookingId: number | null }>();
const emit = defineEmits<{ close: [] }>();

const directory = useDirectory();
const row = computed(() => directory.bookingRows.find((r) => r.id === props.bookingId) ?? null);
const raw = computed(() => directory.bookings.data?.find((b) => b.id === props.bookingId) ?? null);
const offering = computed(() => (raw.value?.offering_id ? directory.offeringById.get(raw.value.offering_id) : undefined));
const canRecordAttendance = computed(() => row.value !== null && !["cancelled", "expired"].includes(row.value.status));
const canCancel = computed(() => row.value !== null && CANCELLABLE_STATUSES.has(row.value.status));

const form = reactive({ kind: "check_in" as Schemas["AttendanceKind"], when: "", reason: "" });
const busy = ref(false);
const error = ref<string | null>(null);

const cancelOpen = ref(false);
const cancelReason = ref("");
const cancelBusy = ref(false);
const cancelError = ref<string | null>(null);

watch(
  () => props.bookingId,
  () => {
    Object.assign(form, { kind: "check_in", when: toBusinessWallTime(new Date()), reason: "" });
    error.value = null;
    cancelOpen.value = false;
    cancelReason.value = "";
    cancelError.value = null;
  },
  { immediate: true },
);

async function recordAttendance(): Promise<void> {
  if (!props.bookingId || form.reason.trim().length < 3 || !form.when) return;
  busy.value = true;
  const { error: e } = await api.POST("/admin/bookings/{booking_id}/manual-attendance", {
    params: { path: { booking_id: props.bookingId } },
    body: { kind: form.kind, occurred_at: fromBusinessWallTime(form.when), reason: form.reason.trim() },
  });
  busy.value = false;
  error.value = e ? errorMessage(e) : null;
  if (e) return;
  toast.success(form.kind === "check_in" ? "Entrada registrada" : "Salida registrada");
  form.reason = "";
  await directory.bookings.refresh();
}

async function cancelBooking(): Promise<void> {
  const reason = cancelReason.value.trim();
  if (!props.bookingId || reason.length < 3) return;
  cancelBusy.value = true;
  const { data, error: e } = await api.POST("/admin/bookings/{booking_id}/cancel", {
    params: { path: { booking_id: props.bookingId } },
    body: { reason },
  });
  cancelBusy.value = false;
  cancelError.value = e ? errorMessage(e) : null;
  if (!data) return;
  cancelOpen.value = false;
  cancelReason.value = "";
  if (data.refund_required) toast.warning("Reserva cancelada. El pago quedó marcado para reembolso.");
  else toast.success("Reserva cancelada");
  await directory.bookings.refresh();
}
</script>

<template>
  <Sheet :open="bookingId !== null" @update:open="(v) => !v && emit('close')">
    <SheetContent class="w-full gap-0 overflow-y-auto sm:max-w-md">
      <template v-if="row">
        <SheetHeader class="gap-2 border-b border-hairline p-6 pr-12">
          <StatusBadge :tone="row.tone" :label="row.statusLabel" />
          <SheetTitle class="title-section">Reserva {{ row.id }}</SheetTitle>
          <SheetDescription class="tabular-nums">{{ row.dayLabel }}, {{ row.timeRange }}</SheetDescription>
        </SheetHeader>

        <dl class="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 p-6">
          <dt class="text-muted-foreground">Servicio</dt>
          <dd>{{ row.offeringName }}<span v-if="offering" class="text-muted-foreground">, {{ offering.duration_minutes }} min</span></dd>
          <dt class="text-muted-foreground">Cliente</dt>
          <dd>
            {{ row.customerName }}
            <a v-if="row.customerEmail" :href="`mailto:${row.customerEmail}`" class="block break-all text-muted-foreground hover:text-text hover:underline">{{ row.customerEmail }}</a>
          </dd>
          <dt class="text-muted-foreground">Persona</dt>
          <dd>{{ row.staffName }}</dd>
          <dt class="text-muted-foreground">Dirección</dt>
          <dd class="text-pretty">{{ row.address }}</dd>
          <dt class="text-muted-foreground">Importe</dt>
          <dd class="tabular-nums">{{ row.amount }}</dd>
          <template v-if="raw?.status === 'held' && raw.hold_expires_at">
            <dt class="text-muted-foreground">Apartado</dt>
            <dd>Vence el {{ formatDateTime(raw.hold_expires_at) }}</dd>
          </template>
        </dl>

        <form v-if="canRecordAttendance" class="grid gap-4 border-t border-hairline p-6" @submit.prevent="recordAttendance">
          <div>
            <h3 class="font-semibold">Registrar asistencia manual</h3>
            <p class="mt-1 text-muted-foreground">Para cuando la persona no pudo registrar su entrada o salida desde la app.</p>
          </div>
          <Tabs v-model="form.kind">
            <TabsList class="w-full" aria-label="Tipo de registro">
              <TabsTrigger value="check_in">Entrada</TabsTrigger>
              <TabsTrigger value="check_out">Salida</TabsTrigger>
            </TabsList>
          </Tabs>
          <div class="grid gap-2">
            <Label for="attendance-when">Fecha y hora (Ciudad de México)</Label>
            <Input id="attendance-when" v-model="form.when" type="datetime-local" required />
          </div>
          <div class="grid gap-2">
            <Label for="attendance-reason">Motivo</Label>
            <Textarea id="attendance-reason" v-model="form.reason" rows="3" minlength="3" maxlength="1000" required placeholder="Ej. llamó para avisar que el teléfono se quedó sin batería" />
          </div>
          <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
          <Button type="submit" :disabled="busy || form.reason.trim().length < 3" :aria-busy="busy">
            {{ form.kind === "check_in" ? "Registrar entrada" : "Registrar salida" }}
          </Button>
        </form>

        <section v-if="canCancel" class="grid gap-3 border-t border-hairline p-6" aria-labelledby="cancel-title">
          <div>
            <h3 id="cancel-title" class="font-semibold">Cancelar reserva</h3>
            <p class="mt-1 text-muted-foreground">Libera el horario de la persona. El cliente verá la visita como cancelada en la app.</p>
          </div>
          <Button variant="outline" class="justify-self-start text-danger hover:text-danger" @click="cancelOpen = true">Cancelar reserva…</Button>
        </section>
      </template>
      <SheetHeader v-else class="p-6">
        <SheetTitle>Reserva no encontrada</SheetTitle>
        <SheetDescription>Puede que se haya cancelado o que aún no cargue la lista de reservas.</SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>

  <Dialog v-model:open="cancelOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="title-section">¿Cancelar la reserva {{ bookingId }}?</DialogTitle>
        <DialogDescription>
          <template v-if="row?.status === 'confirmed'">Esta reserva ya está pagada: el pago quedará marcado para reembolso, pero el reembolso no se hace en automático.</template>
          <template v-else>El horario apartado se libera y el cliente ya no podrá pagarlo.</template>
          No se puede deshacer.
        </DialogDescription>
      </DialogHeader>
      <form id="cancel-form" class="grid gap-2" @submit.prevent="cancelBooking">
        <Label for="cancel-reason">Motivo</Label>
        <Textarea id="cancel-reason" v-model="cancelReason" rows="3" minlength="3" maxlength="1000" required placeholder="Ej. el cliente pidió cancelar por teléfono" />
        <p v-if="cancelError" role="alert" class="text-danger">{{ cancelError }}</p>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="cancelOpen = false">Volver</Button>
        <Button type="submit" form="cancel-form" variant="destructive" :disabled="cancelBusy || cancelReason.trim().length < 3" :aria-busy="cancelBusy">Sí, cancelar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
