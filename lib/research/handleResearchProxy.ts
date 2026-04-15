import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";
import { deductCredits } from "@/lib/credits/deductCredits";

export type HandleResearchProxyParams = {
  accountId: string;
  path: string;
  query?: Record<string, string>;
  /** Credits to charge on success. Defaults to 5. */
  credits?: number;
};

export type HandleResearchProxyResult = { data: unknown } | { error: string; status: number };

/**
 * Proxies a non-artist-scoped research call to Chartmetric and deducts credits
 * on success. Credit-deduction failures are non-fatal — the fetched data is
 * still returned so transient billing failures don't block read endpoints.
 *
 * Auth is intentionally out of scope here — callers (validators) own that.
 *
 * @returns `{ data }` on success, `{ error, status }` on upstream failure.
 */
export async function handleResearchProxy(
  params: HandleResearchProxyParams,
): Promise<HandleResearchProxyResult> {
  const { accountId, path, query, credits = 5 } = params;

  const result = await proxyToChartmetric(path, query);
  if (result.status !== 200) {
    return { error: `Request failed with status ${result.status}`, status: result.status };
  }

  try {
    await deductCredits({ accountId, creditsToDeduct: credits });
  } catch (error) {
    console.error("[research] credit deduction failed:", error);
  }

  return { data: result.data };
}
