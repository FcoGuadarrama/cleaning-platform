<script setup lang="ts">
withDefaults(defineProps<{ variant?: "primary" | "secondary" | "danger"; busy?: boolean; disabled?: boolean; type?: "button" | "submit" }>(), {
  variant: "primary",
  busy: false,
  disabled: false,
  type: "button",
});
const variants = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-surface text-text border border-border",
  danger: "bg-danger text-on-danger",
};
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy"
    class="min-h-11 rounded-md px-4 text-sm font-semibold disabled:bg-disabled disabled:text-on-disabled disabled:cursor-not-allowed"
    :class="disabled || busy ? '' : variants[variant]"
  >
    <slot />
  </button>
</template>
