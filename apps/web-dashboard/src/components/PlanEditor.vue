<script setup lang="ts">
import type { ApiError, Schemas } from "@repo/api-client";
import { computed, reactive, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "../api";
import { formatDateTime, formatMoney, toMinor } from "../viewmodels/format";
import { planEconomics } from "../viewmodels/subscriptionPlans";
import PlanPreview from "./PlanPreview.vue";

type PlanVersion = Schemas["AdminSubscriptionPlanOut"];

/** `base` null creates a plan; otherwise saving creates a new version that replaces `base`. */
const props = defineProps<{ open: boolean; base: PlanVersion | null }>();
const emit = defineEmits<{ close: []; saved: [plan: PlanVersion] }>();

const DAYS = [1, 2, 3, 4, 5] as const;
const blank = { name: "", description: "", days: 1, duration: "", price: "", earning: "", terms: "" };
const form = reactive({ ...blank });
const busy = ref(false);
const error = ref<string | null>(null);

function pesos(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

watch(
  () => [props.open, props.base?.id] as const,
  ([open]) => {
    if (!open) return;
    const b = props.base;
    Object.assign(
      form,
      b
        ? {
            name: b.name,
            description: b.description,
            days: b.days_per_week,
            duration: String(b.visit_duration_minutes),
            price: pesos(b.price_minor),
            earning: pesos(b.staff_earning_minor),
            terms: b.terms,
          }
        : blank,
    );
    error.value = null;
  },
  { immediate: true },
);

const duration = computed(() => {
  const n = /^\d+$/.test(form.duration.trim()) ? Number(form.duration) : null;
  return n !== null && n > 0 && n <= 720 ? n : null;
});
const price = computed(() => {
  const n = toMinor(form.price);
  return n !== null && n > 0 ? n : null;
});
const earning = computed(() => toMinor(form.earning));
const economics = computed(() =>
  price.value !== null && earning.value !== null
    ? planEconomics({ days_per_week: form.days, price_minor: price.value, staff_earning_minor: earning.value })
    : null,
);
const valid = computed(
  () => form.name.trim() !== "" && duration.value !== null && price.value !== null && earning.value !== null && form.terms.trim() !== "",
);
const currency = computed(() => props.base?.currency ?? "MXN");

async function save(): Promise<void> {
  if (!valid.value) return;
  busy.value = true;
  const body = {
    name: form.name.trim(),
    description: form.description.trim(),
    days_per_week: form.days,
    visit_duration_minutes: duration.value!,
    price_minor: price.value!,
    staff_earning_minor: earning.value!,
    currency: currency.value,
    terms: form.terms.trim(),
  };
  const result = props.base
    ? await api.POST("/admin/subscription-plans/{plan_id}/versions", { params: { path: { plan_id: props.base.id } }, body })
    : await api.POST("/admin/subscription-plans", { body });
  busy.value = false;
  if (result.error) {
    error.value =
      (result.error as Partial<ApiError>).code === "plan_superseded"
        ? "Otra persona guardó una versión de este plan mientras editabas. Cierra y vuelve a abrir el plan para ver la más reciente."
        : errorMessage(result.error);
    return;
  }
  emit("saved", result.data);
}
</script>

<template>
  <Sheet :open="open" @update:open="(v) => !v && emit('close')">
    <SheetContent class="w-full gap-0 overflow-y-auto sm:max-w-xl">
      <SheetHeader class="border-b border-hairline p-6 pr-12">
        <SheetTitle class="title-section">{{ base ? `Editar ${base.name}` : "Nuevo plan" }}</SheetTitle>
        <SheetDescription>
          <template v-if="base">
            Al guardar se crea una versión nueva y reemplaza la del {{ formatDateTime(base.created_at) }}. Quien contrate después verá la nueva; la anterior queda en el historial.
          </template>
          <template v-else>Los importes van en pesos mexicanos, con hasta dos decimales.</template>
        </SheetDescription>
      </SheetHeader>

      <form id="plan-form" class="grid gap-5 p-6" @submit.prevent="save">
        <div class="grid gap-2">
          <Label for="plan-name">Nombre</Label>
          <Input id="plan-name" v-model="form.name" required maxlength="80" autocomplete="off" placeholder="Ej. Semanal" />
        </div>
        <div class="grid gap-2">
          <Label for="plan-description">Descripción breve</Label>
          <Input id="plan-description" v-model="form.description" maxlength="300" autocomplete="off" placeholder="Opcional. Una línea que aparece bajo el nombre." />
        </div>

        <fieldset class="grid gap-2">
          <legend class="mb-2 text-sm leading-none font-medium">Días por semana</legend>
          <div class="grid grid-cols-5 gap-0.5 rounded-lg bg-surface p-0.5 ring-1 ring-hairline">
            <label
              v-for="d in DAYS"
              :key="d"
              class="cursor-pointer rounded-md py-1.5 text-center font-medium tabular-nums text-text-muted transition-colors duration-100 select-none hover:text-text active:scale-[0.97] has-checked:bg-surface-raised has-checked:text-text has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-focus"
            >
              <input v-model="form.days" type="radio" name="plan-days" :value="d" class="sr-only" />
              {{ d }}
            </label>
          </div>
          <p class="text-xs text-text-muted">El cliente elige cuáles, de lunes a viernes. Cada día suma 4 visitas al mes.</p>
        </fieldset>

        <div class="grid gap-2">
          <Label for="plan-duration">Duración de cada visita, en minutos</Label>
          <Input id="plan-duration" v-model="form.duration" inputmode="numeric" required class="tabular-nums" :aria-invalid="form.duration !== '' && duration === null" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-2">
            <Label for="plan-price">Precio al mes</Label>
            <Input id="plan-price" v-model="form.price" inputmode="decimal" required class="tabular-nums" :aria-invalid="form.price !== '' && price === null" />
          </div>
          <div class="grid gap-2">
            <Label for="plan-earning">Pago a la persona por visita</Label>
            <Input id="plan-earning" v-model="form.earning" inputmode="decimal" required class="tabular-nums" :aria-invalid="form.earning !== '' && earning === null" />
          </div>
        </div>

        <div class="rounded-lg bg-surface px-4 py-3 tabular-nums" aria-live="polite">
          <dl v-if="economics" class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
            <dt class="text-muted-foreground">{{ economics.visits }} visitas al mes, cada una a</dt>
            <dd class="text-right">{{ formatMoney(economics.perVisitMinor, currency) }}</dd>
            <dt class="text-muted-foreground">Pago a la persona en el mes</dt>
            <dd class="text-right">{{ formatMoney(economics.staffMonthlyMinor, currency) }}</dd>
            <dt class="font-medium">Margen del mes</dt>
            <dd class="text-right font-medium" :class="economics.marginMonthlyMinor < 0 ? 'text-danger' : ''">{{ formatMoney(economics.marginMonthlyMinor, currency) }}</dd>
          </dl>
          <p v-else class="text-muted-foreground">Escribe precio y pago para ver las cuentas del mes.</p>
          <p v-if="economics && economics.marginMonthlyMinor < 0" class="mt-2 text-danger">El pago a la persona supera el precio del plan.</p>
        </div>

        <div class="grid gap-2">
          <Label for="plan-terms">Condiciones</Label>
          <Textarea
            id="plan-terms"
            v-model="form.terms"
            rows="6"
            maxlength="10000"
            required
            aria-describedby="plan-terms-hint"
            placeholder="Qué incluye, cómo se renueva, cambios de fecha con 24 h de aviso…"
          />
          <p id="plan-terms-hint" class="text-xs text-text-muted">El cliente las lee antes de contratar. Cada versión guarda las suyas.</p>
        </div>

        <section class="grid gap-3" aria-labelledby="plan-preview-title">
          <h3 id="plan-preview-title" class="font-semibold">Así lo verán los clientes</h3>
          <PlanPreview
            :name="form.name.trim()"
            :description="form.description.trim()"
            :days-per-week="form.days"
            :duration-minutes="duration"
            :price-minor="price"
            :currency="currency"
          />
        </section>

        <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
      </form>

      <SheetFooter class="mt-auto flex-row justify-end gap-2 border-t border-hairline p-6">
        <Button variant="outline" @click="emit('close')">Cancelar</Button>
        <Button type="submit" form="plan-form" :disabled="busy || !valid" :aria-busy="busy">{{ base ? "Guardar versión nueva" : "Crear plan" }}</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
