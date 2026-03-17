import type { PrivyLoginsPeriod } from "./fetchPrivyLogins";

export const PERIOD_DAYS: Record<PrivyLoginsPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};
