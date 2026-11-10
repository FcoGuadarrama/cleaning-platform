import { createSharedComposable, useColorMode } from "@vueuse/core";

export type ThemeChoice = "auto" | "light" | "dark";

// Must match the pre-paint script in index.html.
export const THEME_STORAGE_KEY = "dashboard.theme";

// Writes the resolved theme to <html data-theme>, which the generated tokens read; "auto" tracks the OS.
export const useTheme = createSharedComposable(() =>
  useColorMode({ selector: "html", attribute: "data-theme", storageKey: THEME_STORAGE_KEY, initialValue: "auto" }),
);
