<script setup lang="ts">
import { computed } from "vue";
import { useDirectory } from "../stores/directory";
import { NAV_GROUPS } from "../navigation";

defineEmits<{ navigate: [] }>();
const directory = useDirectory();
const openExceptions = computed(() => directory.exceptions.data?.length ?? 0);
</script>

<template>
  <nav aria-label="Principal" class="grid gap-6">
    <div v-for="group in NAV_GROUPS" :key="group.label">
    <p class="mb-1.5 px-2.5 text-xs font-medium text-sidebar-muted">{{ group.label }}</p>
    <ul class="space-y-0.5">
      <li v-for="item in group.items" :key="item.to">
        <RouterLink
          v-slot="{ href, navigate, isExactActive, isActive }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            :aria-current="(item.to === '/' ? isExactActive : isActive) ? 'page' : undefined"
            class="group flex h-9 items-center gap-3 rounded-md px-2.5 text-sidebar-muted transition-colors duration-100 select-none hover:bg-on-sidebar/7 hover:text-on-sidebar active:bg-on-sidebar/12 aria-[current=page]:bg-on-sidebar/10 aria-[current=page]:font-medium aria-[current=page]:text-on-sidebar pointer-coarse:h-11"
            @click="navigate($event); $emit('navigate')"
          >
            <component :is="item.icon" class="size-4.5 shrink-0 text-sidebar-muted group-aria-[current=page]:text-sidebar-active" aria-hidden="true" />
            <span class="flex-1">{{ item.label }}</span>
            <span
              v-if="item.to === '/asistencia' && openExceptions > 0"
              class="min-w-5 rounded-full bg-warning-soft px-1.5 text-center text-xs font-semibold leading-5 text-warning tabular-nums"
              :aria-label="`${openExceptions} por resolver`"
            >{{ openExceptions }}</span>
          </a>
        </RouterLink>
      </li>
    </ul>
    </div>
  </nav>
</template>
