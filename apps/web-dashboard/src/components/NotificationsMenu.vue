<script setup lang="ts">
import { Bell } from "@lucide/vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "../stores/notifications";
import { type NotificationItem, unreadLabel } from "../viewmodels/notifications";

const notifications = useNotifications();
const router = useRouter();

async function open(item: NotificationItem): Promise<void> {
  if (item.unread) {
    const error = await notifications.markRead(item.id);
    if (error) toast.error(error);
  }
  if (item.to) await router.push(item.to);
}

async function readAll(): Promise<void> {
  const error = await notifications.markAllRead();
  if (error) toast.error(error);
}

function onOpen(isOpen: boolean): void {
  if (isOpen) void notifications.refresh({ background: true });
}
</script>

<template>
  <DropdownMenu @update:open="onOpen">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="relative"
        :aria-label="notifications.unreadCount ? `Notificaciones, ${notifications.unreadCount} sin leer` : 'Notificaciones'"
      >
        <Bell />
        <span
          v-if="notifications.unreadCount"
          class="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] leading-none font-semibold text-on-primary tabular-nums"
          aria-hidden="true"
        >
          {{ unreadLabel(notifications.unreadCount) }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-[min(24rem,calc(100vw-2rem))] p-0">
      <div class="flex items-center justify-between gap-2 px-3 py-2">
        <DropdownMenuLabel class="p-0 text-sm font-semibold">Notificaciones</DropdownMenuLabel>
        <Button v-if="notifications.unreadCount" variant="link" size="sm" class="h-auto p-0 text-xs" @click="readAll">
          Marcar todo como leído
        </Button>
      </div>
      <DropdownMenuSeparator class="m-0" />
      <div class="max-h-[min(28rem,70dvh)] overflow-y-auto p-1">
        <p v-if="notifications.recent.error" class="px-3 py-6 text-center text-sm text-danger">{{ notifications.recent.error }}</p>
        <p v-else-if="notifications.recent.loaded && !notifications.items.length" class="px-3 py-6 text-center text-sm text-muted-foreground">
          No hay notificaciones.
        </p>
        <DropdownMenuItem
          v-for="item in notifications.items"
          :key="item.id"
          class="items-start gap-3 px-2.5 py-2"
          @select="open(item)"
        >
          <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="item.unread ? 'bg-primary' : 'bg-transparent'" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block" :class="item.unread ? 'font-semibold' : 'font-medium'">
              <span v-if="item.unread" class="sr-only">Sin leer: </span>{{ item.title }}
            </span>
            <span class="block text-muted-foreground">{{ item.body }}</span>
            <span class="mt-0.5 block text-xs text-muted-foreground">{{ item.createdAt }}</span>
          </span>
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
