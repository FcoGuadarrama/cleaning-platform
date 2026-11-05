<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import type { Tone } from "../viewmodels/format";

defineProps<{ tone: Tone; label: string }>();
</script>

<template>
  <Badge :variant="tone">
    <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {{ label }}
  </Badge>
</template>
