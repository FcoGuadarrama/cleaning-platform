import type { Schemas } from "@repo/api-client";

export type Plan = Schemas["SubscriptionPlanOut"];

export const daysLabel = (days: number) => (days === 1 ? "1 día por semana" : `${days} días por semana`);

/** Monthly price spread over the plan's visits, for comparison with a single visit. */
export const perVisitMinor = (plan: Plan) => Math.round(plan.price_minor / plan.visits_per_cycle);
