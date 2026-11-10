<script setup lang="ts">
import { Monitor, Moon, Sun } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ThemeChoice, useTheme } from "../theme";

const mode = useTheme();

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "auto", label: "Sistema", icon: Monitor },
];

const choice = computed({
  get: () => mode.store.value as ThemeChoice,
  set: (value: ThemeChoice) => {
    mode.store.value = value;
  },
});
const TriggerIcon = computed(() => (mode.state.value === "dark" ? Moon : Sun));
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" aria-label="Cambiar tema">
        <component :is="TriggerIcon" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-44">
      <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">Tema</DropdownMenuLabel>
      <DropdownMenuRadioGroup v-model="choice">
        <DropdownMenuRadioItem v-for="option in OPTIONS" :key="option.value" :value="option.value">
          <component :is="option.icon" class="text-muted-foreground" aria-hidden="true" />
          {{ option.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
