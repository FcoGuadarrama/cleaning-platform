<script setup lang="ts">
import { Hash, Tag, UserPlus } from "@lucide/vue";
import { useEventListener } from "@vueuse/core";
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "../navigation";
import { useDirectory } from "../stores/directory";

const open = defineModel<boolean>("open", { required: true });
const router = useRouter();
const directory = useDirectory();
const recentBookings = computed(() => directory.bookingRows.slice(0, 40));

useEventListener(window, "keydown", (e: KeyboardEvent) => {
  if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
  e.preventDefault();
  open.value = !open.value;
});

function go(path: string): void {
  open.value = false;
  void router.push(path);
}
</script>

<template>
  <CommandDialog v-model:open="open">
    <CommandInput placeholder="Busca una sección, acción o número de reserva" />
    <CommandList>
      <CommandEmpty>Nada coincide con esa búsqueda.</CommandEmpty>
      <CommandGroup heading="Secciones">
        <CommandItem v-for="item in NAV_ITEMS" :key="item.to" :value="item.label" @select="go(item.to)">
          <component :is="item.icon" />{{ item.label }}
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Acciones">
        <CommandItem value="Dar de alta a una persona" @select="go('/personal?nuevo=1')"><UserPlus />Dar de alta a una persona</CommandItem>
        <CommandItem value="Crear versión de servicio" @select="go('/servicios?nuevo=1')"><Tag />Crear versión de servicio</CommandItem>
      </CommandGroup>
      <template v-if="recentBookings.length">
        <CommandSeparator />
        <CommandGroup heading="Reservas">
          <CommandItem
            v-for="b in recentBookings"
            :key="b.id"
            :value="`reserva ${b.id} ${b.address} ${b.staffName}`"
            @select="go(`/reservas?reserva=${b.id}`)"
          >
            <Hash />
            <span class="tabular-nums">{{ b.id }}</span>
            <span class="truncate text-muted-foreground">{{ b.address }}</span>
          </CommandItem>
        </CommandGroup>
      </template>
    </CommandList>
  </CommandDialog>
</template>
