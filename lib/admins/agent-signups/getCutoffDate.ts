import type { AdminPeriod } from "@/lib/admins/adminPeriod";

const PERIOD_DAYS: Record<Exclude<AdminPeriod, "all">, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

/**
 * Returns an ISO date string cutoff for the given period, or undefined for "all".
 * Uses midnight UTC calendar day boundaries.
 */
export function getCutoffDate(period: AdminPeriod): string | undefined {
  if (period === "all") return undefined;

  const days = PERIOD_DAYS[period];
  const now = new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      (days - 1) * 24 * 60 * 60 * 1000,
  );
  return cutoff.toISOString();
}
