import { CalendarClock, ClipboardList, MapPinOff, Tag, Users, Wallet } from "@lucide/vue";
import type { Component } from "vue";

export interface NavItem {
  to: string;
  label: string;
  icon: Component;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Hoy", icon: CalendarClock },
  { to: "/reservas", label: "Reservas", icon: ClipboardList },
  { to: "/asistencia", label: "Asistencia", icon: MapPinOff },
  { to: "/liquidaciones", label: "Liquidaciones", icon: Wallet },
  { to: "/personal", label: "Personal", icon: Users },
  { to: "/servicios", label: "Servicios", icon: Tag },
];
