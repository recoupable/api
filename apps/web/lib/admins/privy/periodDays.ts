import type { PrivyLoginsPeriod } from "./privyLoginsPeriod";

export const PERIOD_DAYS: Record<Exclude<PrivyLoginsPeriod, "all">, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};
