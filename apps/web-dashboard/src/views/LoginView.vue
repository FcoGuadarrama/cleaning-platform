<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import UiButton from "../components/UiButton.vue";
import { useSession } from "../stores/session";

const email = ref("");
const password = ref("");
const error = ref<string | null>(null);
const busy = ref(false);
const session = useSession();
const router = useRouter();

async function submit(): Promise<void> {
  busy.value = true;
  error.value = await session.login(email.value, password.value);
  busy.value = false;
  if (!error.value) await router.push("/");
}
</script>

<template>
  <form class="mx-auto mt-16 max-w-sm space-y-4 rounded-lg bg-surface-raised p-6 shadow-2" @submit.prevent="submit">
    <h1 class="text-xl font-bold">Panel de administración</h1>
    <label class="block text-sm">Correo electrónico
      <input v-model="email" type="email" required autocomplete="username" class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" />
    </label>
    <label class="block text-sm">Contraseña
      <input v-model="password" type="password" required autocomplete="current-password" class="mt-1 block min-h-11 w-full rounded-md border border-border bg-background px-3" />
    </label>
    <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
    <UiButton type="submit" :busy="busy" class="w-full">Entrar</UiButton>
  </form>
</template>
