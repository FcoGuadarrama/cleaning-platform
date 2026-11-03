import { createRouter, createWebHistory } from "vue-router";
import { useSession } from "./stores/session";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: () => import("./views/LoginView.vue"), meta: { public: true, title: "Iniciar sesión" } },
    { path: "/", redirect: "/reservas" },
    { path: "/reservas", component: () => import("./views/BookingsView.vue"), meta: { title: "Reservas" } },
    { path: "/personal", component: () => import("./views/StaffView.vue"), meta: { title: "Personal" } },
    { path: "/servicios", component: () => import("./views/OfferingsView.vue"), meta: { title: "Servicios" } },
    { path: "/asistencia", component: () => import("./views/ExceptionsView.vue"), meta: { title: "Excepciones de asistencia" } },
    { path: "/liquidaciones", component: () => import("./views/SettlementsView.vue"), meta: { title: "Liquidaciones semanales" } },
  ],
});

router.beforeEach(async (to) => {
  const session = useSession();
  if (!session.user) await session.restore();
  if (!to.meta.public && !session.user) return "/login";
  document.title = `${String(to.meta.title ?? "")} · Panel`;
  return true;
});
