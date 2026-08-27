/** How a usage page is ordered; both directions are descending. */
export type UsageSort = "created_at" | "cost";

/** The decoded `cursor` for a sort: the keyset the next page continues after. */
export type UsageCursor = { createdAt: string } | { creditsDeducted: number; id: string };
