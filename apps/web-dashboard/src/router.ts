import { createRouter, createWebHistory } from "vue-router";
import { useSession } from "./stores/session";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: () => import("./views/LoginView.vue"), meta: { public: true, title: "Iniciar sesión" } },
    { path: "/", component: () => import("./views/OverviewView.vue"), meta: { title: "Resumen" } },
    { path: "/reservas", component: () => import("./views/BookingsView.vue"), meta: { title: "Reservas" } },
    { path: "/personal", component: () => import("./views/StaffView.vue"), meta: { title: "Personal" } },
    { path: "/servicios", component: () => import("./views/OfferingsView.vue"), meta: { title: "Servicios" } },
    { path: "/suscripciones", component: () => import("./views/SubscriptionsView.vue"), meta: { title: "Suscripciones" } },
    { path: "/asistencia", component: () => import("./views/ExceptionsView.vue"), meta: { title: "Asistencia" } },
    { path: "/liquidaciones", component: () => import("./views/SettlementsView.vue"), meta: { title: "Liquidaciones" } },
    { path: "/:rest(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to) => {
  const session = useSession();
  if (!session.user) await session.restore();
  if (!to.meta.public && !session.user) return { path: "/login", query: to.fullPath === "/" ? {} : { volver: to.fullPath } };
  if (to.path === "/login" && session.user) return "/";
  document.title = `${String(to.meta.title ?? "")} | Panel de operación`;
  return true;
});
