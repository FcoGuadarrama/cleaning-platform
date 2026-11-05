<script setup lang="ts">
import { ChevronsUpDown, LogOut } from "@lucide/vue";
import { useRouter } from "vue-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "../stores/session";
import { initials } from "../viewmodels/format";

const session = useSession();
const router = useRouter();

function logout(): void {
  session.logout();
  void router.push("/login");
}
</script>

<template>
  <DropdownMenu v-if="session.user">
    <DropdownMenuTrigger
      class="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors duration-100 hover:bg-text/6 active:bg-text/10"
    >
      <Avatar class="size-8">
        <AvatarFallback class="bg-primary/12 text-xs font-semibold text-primary">{{ initials(session.user.full_name) }}</AvatarFallback>
      </Avatar>
      <span class="min-w-0 flex-1">
        <span class="block truncate font-medium">{{ session.user.full_name }}</span>
        <span class="block truncate text-xs text-muted-foreground">Administración</span>
      </span>
      <ChevronsUpDown class="size-4 text-muted-foreground" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" class="w-(--reka-dropdown-menu-trigger-width) min-w-56">
      <DropdownMenuLabel class="font-normal">
        <span class="block truncate font-medium">{{ session.user.full_name }}</span>
        <span class="block truncate text-xs text-muted-foreground">{{ session.user.email }}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="logout"><LogOut />Cerrar sesión</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
