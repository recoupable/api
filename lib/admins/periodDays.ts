import type { AdminPeriod } from "./adminPeriod";

export const PERIOD_DAYS: Record<Exclude<AdminPeriod, "all">, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};
