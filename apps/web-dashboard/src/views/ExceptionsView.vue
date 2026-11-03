<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import UiButton from "../components/UiButton.vue";
import { useResource } from "../useResource";

const REASONS: Record<string, string> = {
  permission_denied: "Permiso de ubicación denegado",
  unavailable: "Ubicación no disponible",
  network_error: "Error de conexión",
};
const exceptions = useResource(() => api.GET("/admin/attendance-exceptions"));
const notes = reactive<Record<number, string>>({});
const busyId = ref<number | null>(null);
const error = ref<string | null>(null);
onMounted(exceptions.refresh);

async function resolve(id: number, approve: boolean): Promise<void> {
  busyId.value = id;
  const { error: e } = await api.POST("/admin/attendance-exceptions/{exception_id}/resolve", {
    params: { path: { exception_id: id } },
    body: { approve, note: notes[id] ?? "" },
  });
  busyId.value = null;
  error.value = e ? errorMessage(e) : null;
  if (!e) await exceptions.refresh();
}
</script>

<template>
  <h1 class="mb-2 text-xl font-bold">Excepciones de asistencia</h1>
  <p class="mb-4 max-w-xl text-sm text-text-muted">
    Registros de entrada o salida sin ubicación GPS. Resuélvelos con una nota; queda registro de auditoría.
  </p>
  <p v-if="error" role="alert" class="mb-2 text-sm text-danger">{{ error }}</p>
  <AsyncState :loading="exceptions.loading.value" :error="exceptions.error.value" :empty="!exceptions.data.value?.length" empty-text="No hay excepciones pendientes." @retry="exceptions.refresh">
    <ul class="space-y-3">
      <li v-for="x in exceptions.data.value ?? []" :key="x.id" class="rounded-md bg-surface-raised p-4 shadow-1">
        <p><strong>Reserva #{{ x.booking_id }}</strong> · {{ REASONS[x.reason] ?? x.reason }}</p>
        <label class="mt-2 block text-sm">Nota de resolución (obligatoria)
          <input v-model="notes[x.id]" minlength="3" class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" />
        </label>
        <div class="mt-2 flex gap-2">
          <UiButton :busy="busyId === x.id" :disabled="(notes[x.id] ?? '').length < 3" @click="resolve(x.id, true)">Aprobar</UiButton>
          <UiButton variant="danger" :busy="busyId === x.id" :disabled="(notes[x.id] ?? '').length < 3" @click="resolve(x.id, false)">Rechazar</UiButton>
        </div>
      </li>
    </ul>
  </AsyncState>
</template>
