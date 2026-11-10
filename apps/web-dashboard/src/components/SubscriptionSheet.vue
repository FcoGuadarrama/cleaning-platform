<script setup lang="ts">
import type { Schemas } from "@repo/api-client";
import { computed } from "vue";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDirectory } from "../stores/directory";
import { currentCycle, cycleLabel, scheduleLabel, SUBSCRIPTION_STATUS } from "../viewmodels/contractedSubscriptions";
import { BOOKING_STATUS, businessDay, formatDateTime, formatDayLong, formatDayShort, formatMoney, formatTime } from "../viewmodels/format";
import { formatDuration } from "../viewmodels/subscriptionPlans";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{ subscription: Schemas["AdminSubscriptionOut"] | null }>();
const emit = defineEmits<{ close: [] }>();

const directory = useDirectory();
const s = computed(() => props.subscription);
const cycle = computed(() => (s.value ? currentCycle(s.value) : undefined));
const customer = computed(() => (s.value ? directory.lookups.customer(s.value.customer_id) : null));

/** Lapsed holds are not listed under Reservas, so only live visits link there. */
const linkable = (visit: Schemas["BookingOut"]) => visit.status !== "expired";
</script>

<template>
  <Sheet :open="s !== null" @update:open="(v) => !v && emit('close')">
    <SheetContent class="w-full gap-0 overflow-y-auto sm:max-w-md">
      <template v-if="s && customer">
        <SheetHeader class="gap-2 border-b border-hairline p-6 pr-12">
          <StatusBadge :tone="SUBSCRIPTION_STATUS[s.status].tone" :label="SUBSCRIPTION_STATUS[s.status].label" />
          <SheetTitle class="title-section">{{ customer.name }}</SheetTitle>
          <SheetDescription>{{ s.plan_name }} · contratada el {{ formatDateTime(s.created_at) }}</SheetDescription>
        </SheetHeader>

        <p v-if="s.status === 'held' && cycle?.hold_expires_at" class="border-b border-hairline bg-warning-soft px-6 py-3 text-warning">
          Horarios apartados hasta las {{ formatTime(cycle.hold_expires_at) }}. Si el cliente no paga, se liberan.
        </p>

        <section class="grid gap-3 p-6" aria-labelledby="subscription-sheet-plan">
          <h3 id="subscription-sheet-plan" class="font-semibold">Lo que aceptó el cliente</h3>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt class="text-muted-foreground">Precio por ciclo</dt>
            <dd class="text-right tabular-nums">{{ formatMoney(s.price_minor, s.currency) }}</dd>
            <dt class="text-muted-foreground">Visitas</dt>
            <dd class="text-right">{{ s.visits_per_cycle }} de {{ formatDuration(s.visit_duration_minutes) }}</dd>
            <dt class="text-muted-foreground">Pago a la persona</dt>
            <dd class="text-right tabular-nums">{{ formatMoney(s.staff_earning_minor, s.currency) }} por visita</dd>
            <dt class="text-muted-foreground">Persona</dt>
            <dd class="text-right">{{ directory.lookups.staffName(s.staff_id) }}</dd>
            <dt class="text-muted-foreground">Días y hora</dt>
            <dd class="text-right">{{ scheduleLabel(s.weekdays, s.visit_start) }}</dd>
            <dt class="text-muted-foreground">Domicilio</dt>
            <dd class="text-right text-pretty">{{ s.address }}</dd>
            <template v-if="customer.email">
              <dt class="text-muted-foreground">Correo</dt>
              <dd class="truncate text-right">{{ customer.email }}</dd>
            </template>
          </dl>
        </section>

        <section v-if="cycle" class="grid gap-3 border-t border-hairline p-6" aria-labelledby="subscription-sheet-cycle">
          <div>
            <h3 id="subscription-sheet-cycle" class="font-semibold">Ciclo {{ cycle.sequence }}: {{ cycleLabel(cycle) }}</h3>
            <p class="text-muted-foreground">
              <template v-if="s.renews_on">Se renueva el {{ formatDayLong(s.renews_on).toLowerCase() }}.</template>
              <template v-else-if="cycle.status === 'expired'">El apartado venció sin pago; los horarios quedaron libres.</template>
              <template v-else>Se confirma cuando el cliente paga.</template>
            </p>
          </div>
          <ol class="grouped">
            <li v-for="v in cycle.visits" :key="v.id" class="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2.5">
              <span class="tabular-nums">
                <RouterLink
                  v-if="linkable(v)"
                  :to="{ path: '/reservas', query: { reserva: String(v.id), estado: 'todas' } }"
                  class="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >{{ formatDayShort(businessDay(new Date(v.starts_at))) }}</RouterLink>
                <span v-else class="font-medium">{{ formatDayShort(businessDay(new Date(v.starts_at))) }}</span>
                <span class="block text-muted-foreground">{{ formatTime(v.starts_at) }}–{{ formatTime(v.ends_at) }}</span>
              </span>
              <StatusBadge :tone="BOOKING_STATUS[v.status].tone" :label="BOOKING_STATUS[v.status].label" />
            </li>
          </ol>
        </section>

        <section class="grid gap-2 border-t border-hairline p-6" aria-labelledby="subscription-sheet-terms">
          <h3 id="subscription-sheet-terms" class="font-semibold">Condiciones aceptadas</h3>
          <p class="text-muted-foreground">Aceptadas el {{ formatDateTime(s.terms_accepted_at) }}; no cambian aunque el plan tenga una versión nueva.</p>
          <p class="whitespace-pre-line text-pretty">{{ s.terms }}</p>
        </section>
      </template>
    </SheetContent>
  </Sheet>
</template>
