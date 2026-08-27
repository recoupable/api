import type { Tables } from "@/types/database.types";

/**
 * A `usage_events` row as the database returns it after database#64 renamed
 * `credits_deducted_cents` to `credits_deducted` (the column holds
 * micro-dollars). `types/database.types.ts` is regenerated from prod with
 * `pnpm update-types`, which can only happen once that migration is applied,
 * so this shape carries the rename until then.
 */
export type UsageEventRow = Omit<Tables<"usage_events">, "credits_deducted_cents"> & {
  credits_deducted: number;
};
