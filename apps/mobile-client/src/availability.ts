import { useEffect, useState } from "react";
import { api } from "./api";
import { nextBusinessDays } from "./format";

type Slot = { starts_at: string; ends_at: string };

/** First open slot for a cleaner and service within the next business days (one request per day until found). */
async function firstSlot(staffId: number, offeringId: number, days: string[]): Promise<Slot | null> {
  for (const day of days) {
    const r = await api.GET("/staff/{staff_id}/availability", { params: { path: { staff_id: staffId }, query: { offering_id: offeringId, day } } });
    const slot = r.data?.slots[0];
    if (slot) return slot;
  }
  return null;
}

/** Next open slot per cleaner, looked up in parallel; undefined while loading, null when none is open soon. */
export function useNextSlots(staffIds: number[], offeringId: number | undefined, lookahead = 5) {
  const [slots, setSlots] = useState<Record<number, Slot | null | undefined>>({});
  const key = `${staffIds.join(",")}:${offeringId ?? ""}`;
  useEffect(() => {
    if (!offeringId || !staffIds.length) return;
    let alive = true;
    const days = nextBusinessDays(lookahead);
    setSlots({});
    for (const id of staffIds) {
      void firstSlot(id, offeringId, days)
        .catch(() => null)
        .then((slot) => alive && setSlots((prev) => ({ ...prev, [id]: slot })));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lookahead]);
  return slots;
}

/** Open slots for one cleaner on one day. */
export function useDaySlots(staffId: number, offeringId: number | undefined, day: string) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  useEffect(() => {
    if (!offeringId) return;
    let alive = true;
    setSlots(null);
    void api
      .GET("/staff/{staff_id}/availability", { params: { path: { staff_id: staffId }, query: { offering_id: offeringId, day } } })
      .then((r) => alive && setSlots(r.data?.slots ?? []))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [staffId, offeringId, day]);
  return slots;
}
