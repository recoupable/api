import { expect, it, vi } from "vitest";
import { handleResearch } from "@/lib/research/handleResearch";
import { recordCreditDeduction } from "../recordCreditDeduction";
import { maybeAutoTopUp } from "../maybeAutoTopUp";
import { deductCreditsWithAudit } from "@/lib/supabase/credits_usage/deductCreditsWithAudit";

vi.mock("@/lib/research/songstats/fetchSongstatsResearch", () => ({
  fetchSongstatsResearch: async () => ({ status: 200, data: { artist: "Fixture", streams: 10 } }),
}));
vi.mock("@/lib/supabase/credits_usage/deductCreditsWithAudit", () => ({
  deductCreditsWithAudit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../maybeAutoTopUp", () => ({
  maybeAutoTopUp: vi.fn(async () => ({ kind: "charged", paymentIntentId: "pi_fixture" })),
}));

it("a successful provider-backed research call debits existing credits without reaching auto-purchase", async () => {
  vi.clearAllMocks();
  const result = await handleResearch({ accountId: "owner", path: "/artist/fixture/stats" });
  expect(result).toMatchObject({ data: { artist: "Fixture" } });
  expect(deductCreditsWithAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: "owner",
      event: expect.objectContaining({ source: "api" }),
    }),
  );
  expect(maybeAutoTopUp).not.toHaveBeenCalled();
  // The opt-in web path still reaches the same purchase-capable helper.
  await recordCreditDeduction({ accountId: "owner", creditsToDeduct: 1, source: "web" });
  expect(maybeAutoTopUp).toHaveBeenCalledOnce();
});
