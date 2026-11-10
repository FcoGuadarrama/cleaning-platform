<script setup lang="ts">
import { computed } from "vue";
import { formatMoney } from "../viewmodels/format";
import { daysLabel, formatDuration, VISITS_PER_WEEKDAY, visitsLabel } from "../viewmodels/subscriptionPlans";

const props = defineProps<{
  name: string;
  description: string;
  daysPerWeek: number;
  durationMinutes: number | null;
  priceMinor: number | null;
  currency: string;
}>();

const visits = computed(() => props.daysPerWeek * VISITS_PER_WEEKDAY);
const perVisit = computed(() => (props.priceMinor === null ? null : Math.round(props.priceMinor / visits.value)));
</script>

<template>
  <figure class="rounded-2xl bg-background p-5 ring-1 ring-hairline" aria-label="Vista previa del plan para clientes">
    <p class="title-section" :class="name ? '' : 'text-text-muted'">{{ name || "Nombre del plan" }}</p>
    <p v-if="description" class="mt-1 text-pretty text-muted-foreground">{{ description }}</p>
    <p class="mt-5 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
      <span class="text-[2rem] leading-none font-semibold tracking-[-0.03em]">{{ priceMinor === null ? "—" : formatMoney(priceMinor, currency) }}</span>
      <span class="text-muted-foreground">{{ currency }} al mes</span>
    </p>
    <p v-if="perVisit !== null" class="mt-1 text-muted-foreground tabular-nums">{{ formatMoney(perVisit, currency) }} por visita</p>
    <ul class="mt-5 grid gap-1.5 border-t border-hairline pt-4">
      <li>{{ visitsLabel(visits) }}, {{ daysLabel(daysPerWeek) }} de lunes a viernes</li>
      <li v-if="durationMinutes">{{ formatDuration(durationMinutes) }} por visita</li>
      <li>La misma persona en cada visita</li>
      <li class="text-muted-foreground">Si el mes trae una quinta semana, no se agenda visita extra</li>
    </ul>
  </figure>
</template>
