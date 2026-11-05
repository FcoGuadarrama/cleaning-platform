<script setup lang="ts">
import { computed } from "vue";
import { useDirectory } from "../stores/directory";
import { NAV_ITEMS } from "../navigation";

defineEmits<{ navigate: [] }>();
const directory = useDirectory();
const openExceptions = computed(() => directory.exceptions.data?.length ?? 0);
</script>

<template>
  <nav aria-label="Principal">
    <ul class="space-y-0.5">
      <li v-for="item in NAV_ITEMS" :key="item.to">
        <RouterLink
          v-slot="{ href, navigate, isExactActive, isActive }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            :aria-current="(item.to === '/' ? isExactActive : isActive) ? 'page' : undefined"
            class="group flex h-9 items-center gap-3 rounded-md px-2.5 text-text-muted transition-colors duration-100 select-none hover:bg-text/6 hover:text-foreground active:bg-text/10 aria-[current=page]:bg-text/8 aria-[current=page]:font-medium aria-[current=page]:text-foreground pointer-coarse:h-11"
            @click="navigate($event); $emit('navigate')"
          >
            <component :is="item.icon" class="size-4.5 shrink-0 text-text-muted group-aria-[current=page]:text-primary" aria-hidden="true" />
            <span class="flex-1">{{ item.label }}</span>
            <span
              v-if="item.to === '/asistencia' && openExceptions > 0"
              class="min-w-5 rounded-full bg-warning/14 px-1.5 text-center text-xs font-semibold leading-5 text-warning tabular-nums"
              :aria-label="`${openExceptions} por resolver`"
            >{{ openExceptions }}</span>
          </a>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
