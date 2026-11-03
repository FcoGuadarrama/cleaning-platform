import type { Schemas } from "@repo/api-client";
import { defineStore } from "pinia";
import { ref } from "vue";
import { api, errorMessage, tokenStore } from "../api";

export const useSession = defineStore("session", () => {
  const user = ref<Schemas["UserOut"] | null>(null);

  async function restore(): Promise<void> {
    if (!tokenStore.get()) return;
    const { data } = await api.GET("/auth/me");
    if (data?.role === "admin") user.value = data;
    else tokenStore.clear();
  }

  async function login(email: string, password: string): Promise<string | null> {
    const { data, error } = await api.POST("/auth/login", { body: { email, password } });
    if (error) return errorMessage(error);
    if (data.user.role !== "admin") return "Esta cuenta no tiene acceso al panel de administración.";
    tokenStore.set(data.access_token);
    user.value = data.user;
    return null;
  }

  function logout(): void {
    tokenStore.clear();
    user.value = null;
  }

  return { user, restore, login, logout };
});
