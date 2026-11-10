import type { Schemas } from "@repo/api-client";

type PlanVersion = Schemas["AdminSubscriptionPlanOut"];

/**
 * Mirrors VISITS_PER_WEEKDAY_PER_CYCLE in apps/api/app/models.py, only for the live preview while typing.
 * Saved plans carry the server's `visits_per_cycle`.
 */
export const VISITS_PER_WEEKDAY = 4;

export interface PlanFamily {
  current: PlanVersion;
  /** Older versions, newest first. */
  previous: PlanVersion[];
}

/** One entry per plan: the latest version plus the versions it replaced. Visible plans first. */
export function planFamilies(versions: readonly PlanVersion[]): PlanFamily[] {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const replaced = new Set(versions.flatMap((v) => (v.replaces_id === null ? [] : [v.replaces_id])));
  const families = versions
    .filter((v) => !replaced.has(v.id))
    .map((current) => {
      const previous: PlanVersion[] = [];
      for (let id = current.replaces_id; id !== null; ) {
        const older = byId.get(id);
        if (!older) break;
        previous.push(older);
        id = older.replaces_id;
      }
      return { current, previous };
    });
  return families.sort(
    (a, b) =>
      Number(b.current.is_active) - Number(a.current.is_active) ||
      a.current.days_per_week - b.current.days_per_week ||
      a.current.price_minor - b.current.price_minor,
  );
}

export interface PlanEconomics {
  visits: number;
  perVisitMinor: number;
  staffMonthlyMinor: number;
  marginMonthlyMinor: number;
}

export function planEconomics(plan: { days_per_week: number; price_minor: number; staff_earning_minor: number }): PlanEconomics {
  const visits = plan.days_per_week * VISITS_PER_WEEKDAY;
  const staffMonthlyMinor = plan.staff_earning_minor * visits;
  return {
    visits,
    perVisitMinor: Math.round(plan.price_minor / visits),
    staffMonthlyMinor,
    marginMonthlyMinor: plan.price_minor - staffMonthlyMinor,
  };
}

export function daysLabel(days: number): string {
  return days === 1 ? "1 día por semana" : `${days} días por semana`;
}

export function visitsLabel(visits: number): string {
  return `${visits} visitas al mes`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
