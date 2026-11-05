import { defineStore } from "pinia";
import { computed } from "vue";
import { api } from "../api";
import { useResource } from "../useResource";
import { type Lookups, toBookingRow } from "../viewmodels/format";

/** Bookings, staff and offerings shared by every view that needs to join them. */
export const useDirectory = defineStore("directory", () => {
  const bookings = useResource(() => api.GET("/bookings"));
  const staff = useResource(() => api.GET("/admin/staff"));
  const offerings = useResource(() => api.GET("/offerings"));
  const exceptions = useResource(() => api.GET("/admin/attendance-exceptions"));

  const staffById = computed(() => new Map((staff.data ?? []).map((s) => [s.id, s])));
  const offeringById = computed(() => new Map((offerings.data ?? []).map((o) => [o.id, o])));

  const lookups: Lookups = {
    staffName: (id) => staffById.value.get(id)?.display_name ?? `Persona #${id}`,
    offeringName: (id) => offeringById.value.get(id)?.name ?? `Servicio #${id}`,
  };

  const bookingRows = computed(() =>
    (bookings.data ?? []).map((b) => toBookingRow(b, lookups)).sort((a, b) => b.startsAt - a.startsAt),
  );

  async function refreshAll(): Promise<void> {
    await Promise.all([bookings.refresh(), staff.refresh(), offerings.refresh(), exceptions.refresh()]);
  }

  return { bookings, staff, offerings, exceptions, staffById, offeringById, lookups, bookingRows, refreshAll };
});
