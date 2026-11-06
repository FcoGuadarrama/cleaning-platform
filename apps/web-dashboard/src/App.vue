<script setup lang="ts">
import { useRoute } from "vue-router";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "./components/AppShell.vue";
import { useSession } from "./stores/session";

const session = useSession();
const route = useRoute();
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-3 focus:py-2 focus:shadow-2"
  >Saltar al contenido</a>
  <AppShell v-if="session.user && !route.meta.public" />
  <RouterView v-else />
  <Toaster position="bottom-right" />
</template>
