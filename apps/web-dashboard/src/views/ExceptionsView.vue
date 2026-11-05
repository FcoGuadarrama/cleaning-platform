<script setup lang="ts">
import { Check, MapPinOff, SignalZero, WifiOff, X } from "@lucide/vue";
import { onMounted, reactive, ref, type Component } from "vue";
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

const REASONS: Record<string, { label: string; icon: Component }> = {
  permission_denied: { label: "Permiso de ubicación denegado", icon: MapPinOff },
  unavailable: { label: "Ubicación no disponible", icon: SignalZero },
  network_error: { label: "Sin conexión al registrar", icon: WifiOff },
};
const FALLBACK_REASON = { label: "Sin ubicación", icon: MapPinOff };

const directory = useDirectory();
const notes = reactive<Record<number, string>>({});
const busyId = ref<number | null>(null);
const errors = reactive<Record<number, string | null>>({});

onMounted(directory.refreshAll);

function bookingFor(id: number) {
  return directory.bookingRows.find((r) => r.id === id);
}

function noteOk(id: number): boolean {
  return (notes[id] ?? "").trim().length >= 3;
}

async function resolve(id: number, approve: boolean): Promise<void> {
  busyId.value = id;
  const { error: e } = await api.POST("/admin/attendance-exceptions/{exception_id}/resolve", {
    params: { path: { exception_id: id } },
    body: { approve, note: (notes[id] ?? "").trim() },
  });
  busyId.value = null;
  errors[id] = e ? errorMessage(e) : null;
  if (e) return;
  toast.success(approve ? "Registro aprobado" : "Registro rechazado");
  await directory.exceptions.refresh();
}
</script>

<template>
  <PageHeader
    title="Asistencia"
    description="Entradas y salidas que llegaron sin ubicación GPS. Cada decisión pide una nota y queda en el registro de auditoría."
  />

  <AsyncState
    :loading="directory.exceptions.loading"
    :error="directory.exceptions.error"
    :empty="!directory.exceptions.data?.length"
    empty-text="No hay registros por resolver."
    :rows="2"
    @retry="directory.refreshAll"
  >
    <ul class="grid gap-4">
      <li v-for="x in directory.exceptions.data ?? []" :key="x.id" class="grouped">
        <div class="flex items-start gap-3 px-4 pt-4 pb-3">
          <component :is="(REASONS[x.reason] ?? FALLBACK_REASON).icon" class="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="font-medium">
              <RouterLink :to="{ path: '/reservas', query: { reserva: x.booking_id, estado: 'todas' } }" class="hover:underline">
                Reserva {{ x.booking_id }}
              </RouterLink>
              <template v-if="bookingFor(x.booking_id)">
                <span class="font-normal text-muted-foreground">, {{ bookingFor(x.booking_id)!.staffName }}</span>
              </template>
            </p>
            <p v-if="bookingFor(x.booking_id)" class="truncate text-muted-foreground tabular-nums">
              {{ bookingFor(x.booking_id)!.dayLabel }}, {{ bookingFor(x.booking_id)!.timeRange }}, {{ bookingFor(x.booking_id)!.address }}
            </p>
          </div>
          <Badge variant="warning" class="hidden sm:inline-flex">{{ (REASONS[x.reason] ?? FALLBACK_REASON).label }}</Badge>
        </div>
        <form class="grid gap-3 px-4 pt-3 pb-4" @submit.prevent>
          <div class="grid gap-2">
            <Label :for="`note-${x.id}`">Nota de resolución</Label>
            <Textarea
              :id="`note-${x.id}`"
              v-model="notes[x.id]"
              rows="2"
              minlength="3"
              maxlength="1000"
              placeholder="Qué confirmaste y con quién"
            />
          </div>
          <p v-if="errors[x.id]" role="alert" class="text-danger">{{ errors[x.id] }}</p>
          <div class="flex flex-wrap gap-2">
            <Button :disabled="busyId === x.id || !noteOk(x.id)" :aria-busy="busyId === x.id" @click="resolve(x.id, true)">
              <Check />Aprobar
            </Button>
            <Button variant="outline" class="text-danger" :disabled="busyId === x.id || !noteOk(x.id)" @click="resolve(x.id, false)">
              <X />Rechazar
            </Button>
          </div>
        </form>
      </li>
    </ul>
  </AsyncState>
</template>
