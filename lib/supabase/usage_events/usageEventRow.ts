import type { Tables } from "@/types/database.types";

/** One `usage_events` row; `credits_deducted` is integer micro-dollars. */
export type UsageEventRow = Tables<"usage_events">;
