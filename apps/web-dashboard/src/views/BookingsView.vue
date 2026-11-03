<script setup lang="ts">
import { computed, onMounted } from "vue";
import { api } from "../api";
import AsyncState from "../components/AsyncState.vue";
import { useResource } from "../useResource";
import { toBookingRow } from "../viewmodels/format";

const bookings = useResource(() => api.GET("/bookings"));
const rows = computed(() => (bookings.data.value ?? []).map(toBookingRow));
onMounted(bookings.refresh);
</script>

<template>
  <h1 class="mb-4 text-xl font-bold">Reservas</h1>
  <AsyncState :loading="bookings.loading.value" :error="bookings.error.value" :empty="rows.length === 0" empty-text="Aún no hay reservas." @retry="bookings.refresh">
    <table class="w-full text-left text-sm">
      <caption class="sr-only">Reservas por fecha</caption>
      <thead><tr class="border-b border-border"><th scope="col" class="py-2">#</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col">Importe</th><th scope="col">Dirección</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id" class="border-b border-border">
          <td class="py-2">{{ r.id }}</td><td>{{ r.when }}</td><td>{{ r.status }}</td><td>{{ r.amount }}</td><td>{{ r.address }}</td>
        </tr>
      </tbody>
    </table>
  </AsyncState>
</template>
