<script setup lang="ts">
import { UserPlus } from "@lucide/vue";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { useDirectory } from "../stores/directory";
import { initials } from "../viewmodels/format";

const directory = useDirectory();
const route = useRoute();
const router = useRouter();
const blank = { email: "", password: "", full_name: "", display_name: "", bio: "" };
const form = reactive({ ...blank });
const busy = ref(false);
const error = ref<string | null>(null);

onMounted(directory.refreshAll);

const formOpen = computed({
  get: () => route.query.nuevo === "1",
  set: (open) => void router.replace({ query: { ...route.query, nuevo: open ? "1" : undefined } }),
});

const upcomingByStaff = computed(() => {
  const now = Date.now();
  const counts = new Map<number, number>();
  for (const r of directory.bookingRows) {
    if (r.startsAt > now && (r.status === "confirmed" || r.status === "held")) counts.set(r.staffId, (counts.get(r.staffId) ?? 0) + 1);
  }
  return counts;
});

const staff = computed(() =>
  [...(directory.staff.data ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.display_name.localeCompare(b.display_name, "es-MX")),
);

function upcomingLabel(id: number): string {
  const n = upcomingByStaff.value.get(id) ?? 0;
  if (n === 0) return "Sin reservas próximas";
  return n === 1 ? "1 reserva próxima" : `${n} reservas próximas`;
}

async function create(): Promise<void> {
  busy.value = true;
  const { error: e } = await api.POST("/admin/staff", { body: { ...form } });
  busy.value = false;
  error.value = e ? errorMessage(e) : null;
  if (e) return;
  toast.success(`Cuenta creada para ${form.display_name}`);
  Object.assign(form, blank);
  formOpen.value = false;
  await directory.staff.refresh();
}
</script>

<template>
  <PageHeader title="Personal" description="Las personas de limpieza que reciben reservas. El nombre visible es el que ven los clientes.">
    <Button @click="formOpen = true"><UserPlus />Dar de alta</Button>
  </PageHeader>

  <AsyncState
    :loading="directory.staff.loading"
    :error="directory.staff.error"
    :empty="staff.length === 0"
    empty-text="Aún no hay personal registrado."
    @retry="directory.refreshAll"
  >
    <template #action><Button variant="outline" @click="formOpen = true"><UserPlus />Dar de alta a la primera persona</Button></template>
    <ul class="grouped">
      <li v-for="s in staff" :key="s.id" class="flex items-center gap-4 px-4 py-3">
        <Avatar class="size-10">
          <AvatarFallback class="bg-primary/12 font-semibold text-primary">{{ initials(s.display_name) }}</AvatarFallback>
        </Avatar>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ s.display_name }}</p>
          <p class="truncate text-muted-foreground">{{ s.bio || "Sin presentación" }}</p>
        </div>
        <span class="hidden text-muted-foreground tabular-nums sm:block">{{ upcomingLabel(s.id) }}</span>
        <StatusBadge :tone="s.is_active ? 'success' : 'neutral'" :label="s.is_active ? 'Activa' : 'Inactiva'" />
      </li>
    </ul>
  </AsyncState>

  <Sheet v-model:open="formOpen">
    <SheetContent class="w-full gap-0 overflow-y-auto sm:max-w-md">
      <SheetHeader class="border-b border-hairline p-6 pr-12">
        <SheetTitle class="title-section">Dar de alta</SheetTitle>
        <SheetDescription>Crea la cuenta con la que la persona entra a la app para ver sus reservas y registrar asistencia.</SheetDescription>
      </SheetHeader>
      <form id="staff-form" class="grid gap-5 p-6" @submit.prevent="create">
        <div class="grid gap-2">
          <Label for="staff-full-name">Nombre completo</Label>
          <Input id="staff-full-name" v-model="form.full_name" required maxlength="120" autocomplete="off" />
        </div>
        <div class="grid gap-2">
          <Label for="staff-display-name">Nombre visible para clientes</Label>
          <Input id="staff-display-name" v-model="form.display_name" required maxlength="120" autocomplete="off" />
        </div>
        <div class="grid gap-2">
          <Label for="staff-email">Correo</Label>
          <Input id="staff-email" v-model="form.email" type="email" required autocomplete="off" />
        </div>
        <div class="grid gap-2">
          <Label for="staff-password">Contraseña inicial</Label>
          <Input id="staff-password" v-model="form.password" type="password" minlength="10" maxlength="128" required autocomplete="new-password" aria-describedby="staff-password-hint" />
          <p id="staff-password-hint" class="text-xs text-text-muted">Mínimo 10 caracteres. Compártela por un medio privado.</p>
        </div>
        <div class="grid gap-2">
          <Label for="staff-bio">Presentación</Label>
          <Textarea id="staff-bio" v-model="form.bio" rows="4" maxlength="2000" placeholder="Opcional. Experiencia, zonas donde trabaja, idiomas." />
        </div>
        <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
      </form>
      <SheetFooter class="mt-auto border-t border-hairline p-6">
        <Button type="submit" form="staff-form" :disabled="busy" :aria-busy="busy">Crear cuenta</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
