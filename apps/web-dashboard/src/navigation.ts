import { ClipboardList, LayoutDashboard, MapPinOff, Repeat, Tag, Users, Wallet } from "@lucide/vue";
import type { Component } from "vue";

export interface NavItem {
  to: string;
  label: string;
  icon: Component;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operación",
    items: [
      { to: "/", label: "Resumen", icon: LayoutDashboard },
      { to: "/reservas", label: "Reservas", icon: ClipboardList },
      { to: "/asistencia", label: "Asistencia", icon: MapPinOff },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/liquidaciones", label: "Liquidaciones", icon: Wallet },
      { to: "/personal", label: "Personal", icon: Users },
      { to: "/suscripciones", label: "Suscripciones", icon: Repeat },
      { to: "/servicios", label: "Servicios", icon: Tag },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
