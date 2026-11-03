<script setup lang="ts">
import { useRouter } from "vue-router";
import { useSession } from "./stores/session";

const session = useSession();
const router = useRouter();
const links = [
  { to: "/reservas", label: "Reservas" },
  { to: "/personal", label: "Personal" },
  { to: "/servicios", label: "Servicios" },
  { to: "/asistencia", label: "Asistencia" },
  { to: "/liquidaciones", label: "Liquidaciones" },
];

function logout(): void {
  session.logout();
  void router.push("/login");
}
</script>

<template>
  <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:p-2">Saltar al contenido</a>
  <div class="min-h-screen md:flex">
    <nav v-if="session.user" aria-label="Principal" class="border-b border-border bg-surface p-4 md:w-56 md:border-b-0 md:border-r">
      <ul class="flex flex-wrap gap-2 md:flex-col">
        <li v-for="l in links" :key="l.to">
          <RouterLink :to="l.to" class="block rounded-md px-3 py-2 text-sm" active-class="bg-primary text-on-primary">
            {{ l.label }}
          </RouterLink>
        </li>
      </ul>
      <button type="button" class="mt-4 text-sm text-text-muted underline" @click="logout">Cerrar sesión</button>
    </nav>
    <main id="main" class="flex-1 p-6"><RouterView /></main>
  </div>
</template>
