<script setup lang="ts">
import type { Schemas } from "@repo/api-client";
import { Plus } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import ContractedSubscriptions from "../components/ContractedSubscriptions.vue";
import PageHeader from "../components/PageHeader.vue";
import PlanEditor from "../components/PlanEditor.vue";
import PlanSheet from "../components/PlanSheet.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useDirectory } from "../stores/directory";
import { useResource } from "../useResource";
import { formatMoney } from "../viewmodels/format";
import { daysLabel, formatDuration, planFamilies } from "../viewmodels/subscriptionPlans";

const route = useRoute();
const router = useRouter();
const plans = useResource(() => api.GET("/admin/subscription-plans"));
const toggling = ref(false);
const directory = useDirectory();

onMounted(() => {
  void plans.refresh();
  void directory.subscriptions.refresh();
});

type Section = "planes" | "contratadas";
const section = computed<Section>({
  get: () => (route.query.vista === "contratadas" ? "contratadas" : "planes"),
  set: (v) => void router.replace({ query: { vista: v === "planes" ? undefined : v } }),
});
const activeCount = computed(() => directory.subscriptions.data?.filter((s) => s.status === "active").length);

const families = computed(() => planFamilies(plans.data ?? []));
const visibleCount = computed(() => families.value.filter((f) => f.current.is_active).length);

function queryId(key: string): number | null {
  const raw = route.query[key];
  return typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : null;
}

function setQuery(next: Record<string, string | undefined>): void {
  void router.replace({ query: { ...route.query, plan: undefined, editar: undefined, nuevo: undefined, ...next } });
}

const selected = computed(() => families.value.find((f) => f.current.id === queryId("plan")) ?? null);
const editing = computed(() => families.value.find((f) => f.current.id === queryId("editar"))?.current ?? null);
const editorOpen = computed(() => route.query.nuevo === "1" || editing.value !== null);

async function onSaved(plan: Schemas["AdminSubscriptionPlanOut"]): Promise<void> {
  toast.success(plan.replaces_id === null ? `Plan creado: ${plan.name}` : `Versión nueva guardada: ${plan.name}`);
  await plans.refresh();
  setQuery({ plan: String(plan.id) });
}

async function setVisibility(plan: Schemas["AdminSubscriptionPlanOut"], isActive: boolean): Promise<void> {
  toggling.value = true;
  const { error } = await api.PATCH("/admin/subscription-plans/{plan_id}", {
    params: { path: { plan_id: plan.id } },
    body: { is_active: isActive },
  });
  toggling.value = false;
  if (error) {
    toast.error(errorMessage(error));
    return;
  }
  await plans.refresh();
  if (isActive) toast.success(`${plan.name} ya aparece en la app`);
  else toast.success(`${plan.name} ya no aparece en la app`, { action: { label: "Deshacer", onClick: () => void setVisibility(plan, true) } });
}
</script>

<template>
  <PageHeader
    title="Suscripciones"
    description="Planes mensuales que los clientes ven y contratan en la app. El cobro todavía es de prueba (sandbox)."
  >
    <Button v-if="section === 'planes'" @click="setQuery({ nuevo: '1' })"><Plus />Nuevo plan</Button>
  </PageHeader>

  <Tabs v-model="section" class="mb-5">
    <TabsList aria-label="Sección de suscripciones">
      <TabsTrigger value="planes" class="px-3">Planes</TabsTrigger>
      <TabsTrigger value="contratadas" class="px-3">
        Contratadas
        <span v-if="activeCount !== undefined" class="text-xs text-text-muted tabular-nums" :aria-label="`${activeCount} activas`">{{ activeCount }}</span>
      </TabsTrigger>
    </TabsList>
  </Tabs>

  <ContractedSubscriptions v-if="section === 'contratadas'" />

  <AsyncState
    v-else
    :loading="plans.loading"
    :error="plans.error"
    :empty="families.length === 0"
    empty-text="Aún no hay planes. Lo que configures aquí es lo que verán los clientes."
    @retry="plans.refresh"
  >
    <template #action><Button variant="outline" @click="setQuery({ nuevo: '1' })"><Plus />Crear el primer plan</Button></template>
    <p class="mb-3 text-muted-foreground">
      {{ visibleCount === 1 ? "1 plan visible" : `${visibleCount} planes visibles` }} en la app<template v-if="families.length > visibleCount">, {{ families.length - visibleCount }} oculto{{ families.length - visibleCount === 1 ? "" : "s" }}</template>.
    </p>
    <ul class="grouped">
      <li v-for="f in families" :key="f.current.id">
        <button
          type="button"
          class="grid w-full grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 px-4 py-3.5 text-left transition-colors duration-100 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none active:bg-accent sm:grid-cols-[minmax(0,1fr)_12rem_9rem_auto]"
          :aria-label="`${f.current.name}, ${f.current.is_active ? 'visible' : 'oculto'}. Ver detalle`"
          @click="setQuery({ plan: String(f.current.id) })"
        >
          <span class="min-w-0">
            <span class="block truncate font-medium" :class="f.current.is_active ? '' : 'text-text-muted'">{{ f.current.name }}</span>
            <span class="block truncate text-muted-foreground">{{ f.current.description || "Sin descripción" }}</span>
          </span>
          <span class="hidden text-muted-foreground sm:block">
            {{ daysLabel(f.current.days_per_week) }}
            <span class="block text-xs">{{ f.current.visits_per_cycle }} visitas de {{ formatDuration(f.current.visit_duration_minutes) }}</span>
          </span>
          <span class="text-right tabular-nums sm:text-left">
            {{ formatMoney(f.current.price_minor, f.current.currency) }}
            <span class="block text-xs text-text-muted">al mes</span>
          </span>
          <span class="col-span-2 sm:col-span-1 sm:justify-self-end">
            <StatusBadge :tone="f.current.is_active ? 'success' : 'neutral'" :label="f.current.is_active ? 'Visible' : 'Oculto'" />
          </span>
        </button>
      </li>
    </ul>
  </AsyncState>

  <PlanSheet
    :family="selected"
    :busy="toggling"
    @close="setQuery({})"
    @edit="selected && setQuery({ editar: String(selected.current.id) })"
    @toggle="selected && setVisibility(selected.current, !selected.current.is_active)"
  />
  <PlanEditor :open="editorOpen" :base="editing" @close="setQuery({})" @saved="onSaved" />
</template>
