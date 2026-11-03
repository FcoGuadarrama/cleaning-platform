<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api, errorMessage } from "../api";
import AsyncState from "../components/AsyncState.vue";
import UiButton from "../components/UiButton.vue";
import { useResource } from "../useResource";

const staff = useResource(() => api.GET("/admin/staff"));
const form = reactive({ email: "", password: "", full_name: "", display_name: "", bio: "" });
const busy = ref(false);
const error = ref<string | null>(null);
onMounted(staff.refresh);

async function create(): Promise<void> {
  busy.value = true;
  const { error: e } = await api.POST("/admin/staff", { body: { ...form } });
  busy.value = false;
  error.value = e ? errorMessage(e) : null;
  if (!e) {
    Object.assign(form, { email: "", password: "", full_name: "", display_name: "", bio: "" });
    await staff.refresh();
  }
}
</script>

<template>
  <h1 class="mb-4 text-xl font-bold">Personal</h1>
  <form class="mb-8 grid max-w-xl gap-3 rounded-lg bg-surface p-4" @submit.prevent="create">
    <h2 class="font-semibold">Dar de alta a una persona de limpieza</h2>
    <label class="text-sm">Nombre completo<input v-model="form.full_name" required class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" /></label>
    <label class="text-sm">Nombre visible para clientes<input v-model="form.display_name" required class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" /></label>
    <label class="text-sm">Correo<input v-model="form.email" type="email" required class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" /></label>
    <label class="text-sm">Contraseña inicial (mín. 10)<input v-model="form.password" type="password" minlength="10" required autocomplete="new-password" class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" /></label>
    <label class="text-sm">Presentación<textarea v-model="form.bio" class="mt-1 block w-full rounded-md border border-border bg-background p-3" /></label>
    <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
    <UiButton type="submit" :busy="busy">Crear cuenta</UiButton>
  </form>
  <AsyncState :loading="staff.loading.value" :error="staff.error.value" :empty="!staff.data.value?.length" empty-text="Aún no hay personal registrado." @retry="staff.refresh">
    <ul class="space-y-2">
      <li v-for="s in staff.data.value ?? []" :key="s.id" class="rounded-md bg-surface-raised p-3 shadow-1">
        <strong>{{ s.display_name }}</strong> <span class="text-text-muted">· {{ s.is_active ? "Activa" : "Inactiva" }}</span>
      </li>
    </ul>
  </AsyncState>
</template>
