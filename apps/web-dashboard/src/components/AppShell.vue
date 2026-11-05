<script setup lang="ts">
import { Menu, Search } from "@lucide/vue";
import { useWindowScroll } from "@vueuse/core";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDirectory } from "../stores/directory";
import AppNav from "./AppNav.vue";
import CommandMenu from "./CommandMenu.vue";
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

onMounted(() => {
  void directory.exceptions.refresh();
});
</script>

<template>
  <div class="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
    <aside class="sticky top-0 hidden h-dvh flex-col border-r border-hairline bg-surface px-3 pt-5 pb-3 md:flex">
      <p class="mb-6 px-2.5 text-md font-semibold tracking-[-0.01em]">Panel de operación</p>
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
      </header>

      <main id="main" tabindex="-1" class="mx-auto max-w-6xl px-4 pt-4 pb-16 outline-none md:px-8">
        <RouterView />
      </main>
    </div>
  </div>

  <Sheet v-model:open="navOpen">
    <SheetContent side="left" class="w-72 bg-surface px-3 pt-5">
      <SheetHeader class="px-2.5 pb-2">
        <SheetTitle>Panel de operación</SheetTitle>
        <SheetDescription class="sr-only">Secciones del panel</SheetDescription>
      </SheetHeader>
      <AppNav @navigate="navOpen = false" />
      <div class="mt-auto pb-3"><UserMenu /></div>
    </SheetContent>
  </Sheet>

  <CommandMenu v-model:open="searchOpen" />
</template>
