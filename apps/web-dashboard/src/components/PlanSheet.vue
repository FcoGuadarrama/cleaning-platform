<script setup lang="ts">
import { Eye, EyeOff, Pencil } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime, formatMoney } from "../viewmodels/format";
import { daysLabel, formatDuration, planEconomics, type PlanFamily } from "../viewmodels/subscriptionPlans";
import PlanPreview from "./PlanPreview.vue";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{ family: PlanFamily | null; busy: boolean }>();
const emit = defineEmits<{ close: []; edit: []; toggle: [] }>();

const plan = computed(() => props.family?.current ?? null);
const economics = computed(() => (plan.value ? planEconomics(plan.value) : null));
const versionNumber = computed(() => (props.family ? props.family.previous.length + 1 : 0));
</script>

<template>
  <Sheet :open="family !== null" @update:open="(v) => !v && emit('close')">
    <SheetContent class="w-full gap-0 overflow-y-auto sm:max-w-md">
      <template v-if="family && plan && economics">
        <SheetHeader class="gap-2 border-b border-hairline p-6 pr-12">
          <StatusBadge :tone="plan.is_active ? 'success' : 'neutral'" :label="plan.is_active ? 'Visible para clientes' : 'Oculto'" />
          <SheetTitle class="title-section">{{ plan.name }}</SheetTitle>
          <SheetDescription>Versión {{ versionNumber }}, guardada el {{ formatDateTime(plan.created_at) }}</SheetDescription>
        </SheetHeader>

        <section class="grid gap-3 p-6" aria-labelledby="plan-sheet-preview">
          <h3 id="plan-sheet-preview" class="font-semibold">Lo que ve el cliente</h3>
          <PlanPreview
            :name="plan.name"
            :description="plan.description"
            :days-per-week="plan.days_per_week"
            :duration-minutes="plan.visit_duration_minutes"
            :price-minor="plan.price_minor"
            :currency="plan.currency"
          />
        </section>

        <section class="grid gap-3 border-t border-hairline p-6" aria-labelledby="plan-sheet-money">
          <h3 id="plan-sheet-money" class="font-semibold">Cuentas del mes</h3>
          <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 tabular-nums">
            <dt class="text-muted-foreground">Precio al cliente</dt>
            <dd class="text-right">{{ formatMoney(plan.price_minor, plan.currency) }}</dd>
            <dt class="text-muted-foreground">Visitas</dt>
            <dd class="text-right">{{ plan.visits_per_cycle }}</dd>
            <dt class="text-muted-foreground">Pago a la persona</dt>
            <dd class="text-right">
              {{ formatMoney(economics.staffMonthlyMinor, plan.currency) }}
              <span class="block text-xs text-text-muted">{{ formatMoney(plan.staff_earning_minor, plan.currency) }} por visita</span>
            </dd>
            <dt class="font-medium">Margen</dt>
            <dd class="text-right font-medium" :class="economics.marginMonthlyMinor < 0 ? 'text-danger' : ''">
              {{ formatMoney(economics.marginMonthlyMinor, plan.currency) }}
            </dd>
          </dl>
        </section>

        <section class="grid gap-2 border-t border-hairline p-6" aria-labelledby="plan-sheet-terms">
          <h3 id="plan-sheet-terms" class="font-semibold">Condiciones</h3>
          <p class="whitespace-pre-line text-pretty">{{ plan.terms }}</p>
        </section>

        <section v-if="family.previous.length" class="grid gap-3 border-t border-hairline p-6" aria-labelledby="plan-sheet-versions">
          <h3 id="plan-sheet-versions" class="font-semibold">Versiones anteriores</h3>
          <ol class="grid gap-2">
            <li v-for="(v, i) in family.previous" :key="v.id" class="grid grid-cols-[1fr_auto] gap-x-4 tabular-nums">
              <span>Versión {{ family.previous.length - i }}<span class="block text-xs text-text-muted">{{ formatDateTime(v.created_at) }}</span></span>
              <span class="text-right">
                {{ formatMoney(v.price_minor, v.currency) }}
                <span class="block text-xs text-text-muted">{{ daysLabel(v.days_per_week) }}, {{ formatDuration(v.visit_duration_minutes) }}</span>
              </span>
            </li>
          </ol>
        </section>

        <SheetFooter class="mt-auto flex-row justify-end gap-2 border-t border-hairline p-6">
          <Button variant="outline" :disabled="busy" :aria-busy="busy" @click="emit('toggle')">
            <template v-if="plan.is_active"><EyeOff />Ocultar a clientes</template>
            <template v-else><Eye />Mostrar a clientes</template>
          </Button>
          <Button @click="emit('edit')"><Pencil />Editar</Button>
        </SheetFooter>
      </template>
    </SheetContent>
  </Sheet>
</template>
