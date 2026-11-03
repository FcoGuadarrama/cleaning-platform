<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import UiButton from "../components/UiButton.vue";
import { useResource } from "../useResource";
import { formatMoney, toMinor } from "../viewmodels/format";

const offerings = useResource(() => api.GET("/offerings"));
const form = reactive({ name: "", duration_minutes: 0, price: "", earning: "" });
const busy = ref(false);
const error = ref<string | null>(null);
const price = computed(() => toMinor(form.price));
const earning = computed(() => toMinor(form.earning));
const valid = computed(() => form.name && form.duration_minutes > 0 && price.value !== null && earning.value !== null);
onMounted(offerings.refresh);

async function create(): Promise<void> {
  if (!valid.value) return;
  busy.value = true;
  const { error: e } = await api.POST("/admin/offerings", {
    body: { name: form.name, duration_minutes: form.duration_minutes, price_minor: price.value!, staff_earning_minor: earning.value! },
  });
  busy.value = false;
  error.value = e ? errorMessage(e) : null;
  if (!e) await offerings.refresh();
}
</script>

<template>
  <h1 class="mb-2 text-xl font-bold">Servicios</h1>
  <p class="mb-4 max-w-xl text-sm text-text-muted">
    Cada cambio de precio crea una versión nueva; las reservas existentes conservan el precio y el pago acordados.
  </p>
  <form class="mb-8 grid max-w-xl gap-3 rounded-lg bg-surface p-4" @submit.prevent="create">
    <label class="text-sm">Nombre<input v-model="form.name" required class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" /></label>
    <label class="text-sm">Duración (minutos)<input v-model.number="form.duration_minutes" type="number" min="1" required class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" /></label>
    <label class="text-sm">Precio al cliente (MXN)<input v-model="form.price" inputmode="decimal" required class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" /></label>
    <label class="text-sm">Pago a la persona por servicio completado (MXN)<input v-model="form.earning" inputmode="decimal" required class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" /></label>
    <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
    <UiButton type="submit" :busy="busy" :disabled="!valid">Crear versión</UiButton>
  </form>
  <AsyncState :loading="offerings.loading.value" :error="offerings.error.value" :empty="!offerings.data.value?.length" empty-text="No hay servicios configurados. Los precios aún no están aprobados." @retry="offerings.refresh">
    <ul class="space-y-2">
      <li v-for="o in offerings.data.value ?? []" :key="o.id" class="rounded-md bg-surface-raised p-3 shadow-1">
        <strong>{{ o.name }}</strong> · {{ o.duration_minutes }} min · {{ formatMoney(o.price_minor, o.currency) }}
        <span class="text-text-muted">(pago: {{ formatMoney(o.staff_earning_minor, o.currency) }})</span>
      </li>
    </ul>
  </AsyncState>
</template>
