import { defineStore } from "pinia";
import { computed } from "vue";
import { api } from "../api";
import { useResource } from "../useResource";
import { type Lookups, toBookingRow } from "../viewmodels/format";

/** Bookings, staff, offerings, customers and contracted subscriptions shared by every view that joins them. */
export const useDirectory = defineStore("directory", () => {
  const bookings = useResource(() => api.GET("/bookings"));
  const staff = useResource(() => api.GET("/admin/staff"));
  const offerings = useResource(() => api.GET("/offerings"));
  const customers = useResource(() => api.GET("/admin/customers"));
  const exceptions = useResource(() => api.GET("/admin/attendance-exceptions"));
  const subscriptions = useResource(() => api.GET("/admin/subscriptions"));
  const transfers = useResource(() => api.GET("/admin/transfers"));

  const staffById = computed(() => new Map((staff.data ?? []).map((s) => [s.id, s])));
  const offeringById = computed(() => new Map((offerings.data ?? []).map((o) => [o.id, o])));
  const customerById = computed(() => new Map((customers.data ?? []).map((c) => [c.id, c])));

  const lookups: Lookups = {
    staffName: (id) => staffById.value.get(id)?.display_name ?? `Persona #${id}`,
    offeringName: (id) => offeringById.value.get(id)?.name ?? `Servicio #${id}`,
    customer: (id) => {
      const c = customerById.value.get(id);
      return c ? { name: c.full_name, email: c.email } : { name: `Cliente #${id}`, email: null };
    },
  };

  const bookingRows = computed(() =>
    (bookings.data ?? []).map((b) => toBookingRow(b, lookups)).sort((a, b) => b.startsAt - a.startsAt),
  );

  async function refreshAll(): Promise<void> {
    await Promise.all([bookings, staff, offerings, customers, exceptions].map((r) => r.refresh()));
  }

  /** Polled while the panel is visible so bookings and plans contracted in the mobile app show up without a reload. */
  async function refreshLive(): Promise<void> {
    const live = [bookings, customers, exceptions, subscriptions, transfers].filter((r) => r.loaded);
    await Promise.all(live.map((r) => r.refresh({ background: true })));
  }

  return {
    bookings,
    staff,
    offerings,
    customers,
    exceptions,
    subscriptions,
    transfers,
    staffById,
    offeringById,
    customerById,
    lookups,
    bookingRows,
    refreshAll,
    refreshLive,
  };
});
