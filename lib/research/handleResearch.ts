import { fetchResearchProvider } from "@/lib/research/providers/fetchResearchProvider";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

export type HandleResearchParams = {
  accountId: string;
  path: string;
  query?: Record<string, string>;
  /** Credits to charge on success. Defaults to 5. */
  credits?: number;
};

export type HandleResearchResult = { data: unknown } | { error: string; status: number };

/**
 * Proxies a non-artist-scoped research call to the configured research data
 * provider and deducts credits on success. Credit-deduction failures are
 * non-fatal so transient billing failures don't block read endpoints.
 *
 * Credit gating (auto-recharge + 402 short-circuit) lives in route handlers
 * via `ensureCreditsOrShortCircuit` — keeping this helper free of NextResponse
 * means non-route consumers (e.g. `resolveTrack`) keep working unchanged.
 *
 * @returns `{ data }` on success, `{ error, status }` on upstream failure.
 */
export async function handleResearch(params: HandleResearchParams): Promise<HandleResearchResult> {
  const { accountId, path, query, credits = 5 } = params;

  const result = await fetchResearchProvider(path, query);
  if (result.status !== 200) {
    return { error: `Request failed with status ${result.status}`, status: result.status };
  }

  try {
    await recordCreditDeduction({
      accountId,
      creditsToDeduct: credits,
      source: "api",
    });
  } catch (error) {
    console.error("[research] credit deduction failed:", error);
  }

  return { data: result.data };
}
