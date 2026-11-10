<script setup lang="ts">
import { BrushCleaning, Menu, Search } from "@lucide/vue";
import { useDocumentVisibility, useIntervalFn, useWindowScroll } from "@vueuse/core";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDirectory } from "../stores/directory";
import AppNav from "./AppNav.vue";
import CommandMenu from "./CommandMenu.vue";
import ThemeMenu from "./ThemeMenu.vue";
import UserMenu from "./UserMenu.vue";

const route = useRoute();
const directory = useDirectory();
const navOpen = ref(false);
const searchOpen = ref(false);
const { y } = useWindowScroll();
// The large page title scrolls away; the bar then shows it inline, as an iOS navigation bar does.
const condensed = computed(() => y.value > 48);
const title = computed(() => String(route.meta.title ?? ""));
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

const LIVE_REFRESH_MS = 30_000;
const visibility = useDocumentVisibility();

onMounted(() => {
  void directory.exceptions.refresh();
});

useIntervalFn(() => {
  if (visibility.value === "visible") void directory.refreshLive();
}, LIVE_REFRESH_MS);
watch(visibility, (state) => {
  if (state === "visible") void directory.refreshLive();
});
</script>

<template>
  <div class="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
    <aside class="sticky top-0 hidden h-dvh flex-col bg-sidebar px-3 pt-4 pb-3 text-on-sidebar md:flex">
      <div class="mb-7 flex items-center gap-2.5 px-1.5">
        <span class="grid size-8 place-items-center rounded-lg bg-primary text-on-primary" aria-hidden="true"><BrushCleaning class="size-4.5" /></span>
        <span class="leading-tight">
          <span class="block font-semibold tracking-[-0.01em]">Panel de operación</span>
          <span class="block text-xs text-sidebar-muted">Servicios de limpieza</span>
        </span>
      </div>
      <AppNav />
      <div class="mt-auto"><UserMenu /></div>
    </aside>

    <div class="min-w-0">
      <header
        class="material-bar sticky top-0 z-30 flex h-14 items-center gap-2 px-4 transition-shadow duration-200 md:px-8"
        :class="condensed ? 'shadow-[0_1px_0_var(--color-hairline)]' : ''"
      >
        <Button variant="ghost" size="icon" class="-ml-2 md:hidden" aria-label="Abrir menú" @click="navOpen = true">
          <Menu />
        </Button>
        <p
          class="truncate font-semibold transition-opacity duration-200"
          :class="condensed ? 'opacity-100' : 'opacity-0'"
          aria-hidden="true"
        >
          {{ title }}
        </p>
        <Button
          variant="outline"
          class="ml-auto h-9 w-9 justify-start gap-2 px-0 text-muted-foreground sm:w-64 sm:px-3"
          aria-label="Buscar"
          @click="searchOpen = true"
        >
          <Search class="mx-auto sm:mx-0" />
          <span class="hidden sm:inline">Buscar</span>
          <Kbd class="ml-auto hidden sm:inline-flex">{{ isMac ? "⌘" : "Ctrl" }} K</Kbd>
        </Button>
        <ThemeMenu />
      </header>

      <main id="main" tabindex="-1" class="mx-auto max-w-[90rem] px-4 pt-4 pb-16 outline-none md:px-8">
        <RouterView />
      </main>
    </div>
  </div>

  <Sheet v-model:open="navOpen">
    <SheetContent side="left" class="w-72 border-none bg-sidebar px-3 pt-5 text-on-sidebar">
      <SheetHeader class="px-2.5 pb-2">
        <SheetTitle class="text-on-sidebar">Panel de operación</SheetTitle>
        <SheetDescription class="sr-only">Secciones del panel</SheetDescription>
      </SheetHeader>
      <AppNav @navigate="navOpen = false" />
      <div class="mt-auto pb-3"><UserMenu /></div>
    </SheetContent>
  </Sheet>

  <CommandMenu v-model:open="searchOpen" />
</template>
