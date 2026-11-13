import type { Schemas } from "@repo/api-client";
import { router } from "expo-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, errorMessage, tokenStore } from "./api";
import { unregisterPush } from "./push";

type User = Schemas["UserOut"];
interface Session {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, fullName: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      if (await tokenStore.load()) {
        const { data } = await api.GET("/auth/me");
        if (data) setUser(data);
        else await tokenStore.clear();
      }
      setReady(true);
    })();
  }, []);

  async function accept(result: { data?: Schemas["TokenOut"]; error?: unknown }): Promise<string | null> {
    if (!result.data) return errorMessage(result.error);
    if (result.data.user.role === "admin") return "Las cuentas de administración usan el panel web.";
    await tokenStore.save(result.data.access_token);
    setUser(result.data.user);
    return null;
  }

  async function authenticate(request: Promise<{ data?: Schemas["TokenOut"]; error?: unknown }>) {
    try {
      return await accept(await request);
    } catch (error) {
      if (error instanceof TypeError) {
        return "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.";
      }
      return errorMessage(error);
    }
  }

  const value: Session = {
    user,
    ready,
    login: (email, password) => authenticate(api.POST("/auth/login", { body: { email, password } })),
    register: async (email, password, full_name) =>
      authenticate(api.POST("/auth/register", { body: { email, password, full_name } })),
    logout: async () => {
      // Leave the protected group before its guard flips; dropping the user while a role screen is still mounted
      // makes expo-router's guard fallback and the index redirect bounce forever ("Maximum update depth exceeded").
      router.replace("/login");
      await unregisterPush();
      await tokenStore.clear();
      setUser(null);
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}
