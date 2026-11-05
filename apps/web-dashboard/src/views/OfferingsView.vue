<script setup lang="ts">
import { Plus } from "@lucide/vue";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useDirectory } from "../stores/directory";
import { formatMoney, toMinor } from "../viewmodels/format";

const directory = useDirectory();
const route = useRoute();
const router = useRouter();
const form = reactive({ name: "", duration: "", price: "", earning: "" });
const busy = ref(false);
const error = ref<string | null>(null);

onMounted(() => directory.offerings.refresh());

const dialogOpen = computed({
  get: () => route.query.nuevo === "1",
  set: (open) => void router.replace({ query: { ...route.query, nuevo: open ? "1" : undefined } }),
});

const duration = computed(() => (/^\d+$/.test(form.duration.trim()) ? Number(form.duration) : null));
const price = computed(() => toMinor(form.price));
const earning = computed(() => toMinor(form.earning));
const valid = computed(() => form.name.trim() !== "" && (duration.value ?? 0) > 0 && price.value !== null && earning.value !== null);
const difference = computed(() => (price.value !== null && earning.value !== null ? price.value - earning.value : null));

const offerings = computed(() =>
  [...(directory.offerings.data ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, "es-MX")),
);

async function create(): Promise<void> {
  if (!valid.value) return;
  busy.value = true;
  const { error: e } = await api.POST("/admin/offerings", {
    body: { name: form.name.trim(), duration_minutes: duration.value!, price_minor: price.value!, staff_earning_minor: earning.value! },
  });
  busy.value = false;
  error.value = e ? errorMessage(e) : null;
  if (e) return;
  toast.success(`Versión creada: ${form.name.trim()}`);
  Object.assign(form, { name: "", duration: "", price: "", earning: "" });
  dialogOpen.value = false;
  await directory.offerings.refresh();
}
</script>

<template>
  <PageHeader
    title="Servicios"
    description="Cada cambio de precio crea una versión nueva. Las reservas que ya existen conservan el precio y el pago con que se hicieron."
  >
    <Button @click="dialogOpen = true"><Plus />Nueva versión</Button>
  </PageHeader>

  <AsyncState
    :loading="directory.offerings.loading"
    :error="directory.offerings.error"
    :empty="offerings.length === 0"
    empty-text="No hay servicios configurados. Los precios aún no están aprobados."
    @retry="directory.offerings.refresh"
  >
    <div class="grouped">
      <Table>
        <caption class="sr-only">Versiones de servicio con precio y pago por servicio completado</caption>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="pl-4 text-text-muted">Servicio</TableHead>
            <TableHead class="text-right text-text-muted">Duración</TableHead>
            <TableHead class="text-right text-text-muted">Precio al cliente</TableHead>
            <TableHead class="text-right text-text-muted">Pago a la persona</TableHead>
            <TableHead class="hidden text-right text-text-muted md:table-cell">Diferencia</TableHead>
            <TableHead class="pr-4 text-text-muted">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="o in offerings" :key="o.id" class="border-hairline hover:bg-transparent">
            <TableCell class="pl-4 font-medium">{{ o.name }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ o.duration_minutes }} min</TableCell>
            <TableCell class="text-right tabular-nums">{{ formatMoney(o.price_minor, o.currency) }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ formatMoney(o.staff_earning_minor, o.currency) }}</TableCell>
            <TableCell class="hidden text-right text-muted-foreground tabular-nums md:table-cell">
              {{ formatMoney(o.price_minor - o.staff_earning_minor, o.currency) }}
            </TableCell>
            <TableCell class="pr-4">
              <StatusBadge :tone="o.is_active ? 'success' : 'neutral'" :label="o.is_active ? 'Activa' : 'Inactiva'" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </AsyncState>

  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="title-section">Nueva versión de servicio</DialogTitle>
        <DialogDescription>Los importes van en pesos mexicanos, con hasta dos decimales.</DialogDescription>
      </DialogHeader>
      <form id="offering-form" class="grid gap-4" @submit.prevent="create">
        <div class="grid gap-2">
          <Label for="offering-name">Nombre</Label>
          <Input id="offering-name" v-model="form.name" required placeholder="Ej. Limpieza general, departamento" />
        </div>
        <div class="grid gap-2">
          <Label for="offering-duration">Duración en minutos</Label>
          <Input id="offering-duration" v-model="form.duration" inputmode="numeric" required :aria-invalid="form.duration !== '' && !duration" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="grid gap-2">
            <Label for="offering-price">Precio al cliente</Label>
            <Input id="offering-price" v-model="form.price" inputmode="decimal" required class="tabular-nums" :aria-invalid="form.price !== '' && price === null" />
          </div>
          <div class="grid gap-2">
            <Label for="offering-earning">Pago a la persona</Label>
            <Input id="offering-earning" v-model="form.earning" inputmode="decimal" required class="tabular-nums" :aria-invalid="form.earning !== '' && earning === null" />
          </div>
        </div>
        <p class="text-muted-foreground tabular-nums" aria-live="polite">
          <template v-if="difference !== null">Diferencia por servicio: {{ formatMoney(difference, "MXN") }}</template>
          <template v-else>Escribe precio y pago para ver la diferencia.</template>
        </p>
        <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="dialogOpen = false">Cancelar</Button>
        <Button type="submit" form="offering-form" :disabled="busy || !valid" :aria-busy="busy">Crear versión</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
