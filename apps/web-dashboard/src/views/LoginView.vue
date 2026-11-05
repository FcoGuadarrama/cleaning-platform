<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "../stores/session";

const email = ref("");
const password = ref("");
const error = ref<string | null>(null);
const busy = ref(false);
const session = useSession();
const route = useRoute();
const router = useRouter();

async function submit(): Promise<void> {
  busy.value = true;
  error.value = await session.login(email.value, password.value);
  busy.value = false;
  if (error.value) return;
  const back = typeof route.query.volver === "string" && route.query.volver.startsWith("/") ? route.query.volver : "/";
  await router.push(back);
}
</script>

<template>
  <main id="main" class="grid min-h-dvh place-items-center bg-surface px-4 py-12">
    <div class="w-full max-w-sm">
      <h1 class="title-large">Panel de operación</h1>
      <p class="mt-1 text-muted-foreground">Entra con tu cuenta de administración.</p>
      <form class="mt-8 grid gap-5 rounded-xl bg-surface-raised p-6 ring-1 ring-hairline" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="login-email">Correo</Label>
          <Input id="login-email" v-model="email" type="email" required autocomplete="username" class="h-11" />
        </div>
        <div class="grid gap-2">
          <Label for="login-password">Contraseña</Label>
          <Input id="login-password" v-model="password" type="password" required autocomplete="current-password" class="h-11" />
        </div>
        <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
        <Button type="submit" size="lg" :disabled="busy" :aria-busy="busy">{{ busy ? "Entrando…" : "Entrar" }}</Button>
      </form>
    </div>
  </main>
</template>
