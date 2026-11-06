import type { Schemas } from "@repo/api-client";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useSession } from "./session";

/** Navigation convenience only — the API enforces roles and ownership. */
export function RoleGate({ role, children }: { role: Schemas["Role"]; children: ReactNode }) {
  const { user, ready } = useSession();
  // Screens wait for the stored session, so a deep link never fires requests without the token.
  if (!ready) return null;
  if (user?.role !== role) return <Redirect href="/" />;
  return <>{children}</>;
}
