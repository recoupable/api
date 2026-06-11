import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBackfillBudgetStep } from "../getBackfillBudgetStep";

import { selectSongstatsQuotaSpent } from "@/lib/supabase/songstats_quota_ledger/selectSongstatsQuotaSpent";

vi.mock("@/lib/supabase/songstats_quota_ledger/selectSongstatsQuotaSpent", () => ({
  selectSongstatsQuotaSpent: vi.fn(),
}));

describe("getBackfillBudgetStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SONGSTATS_QUOTA_LIMIT;
    delete process.env.SONGSTATS_QUOTA_RESERVE;
  });

  it("computes limit - reserve - spent over the rolling 30d window", async () => {
    vi.mocked(selectSongstatsQuotaSpent).mockResolvedValue(300);

    const budget = await getBackfillBudgetStep();

    expect(budget).toBe(1000 - 100 - 300);
    const since = vi.mocked(selectSongstatsQuotaSpent).mock.calls[0][0];
    const ageDays = (Date.now() - new Date(since).getTime()) / 86400000;
    expect(Math.round(ageDays)).toBe(30);
  });

  it("never returns negative", async () => {
    vi.mocked(selectSongstatsQuotaSpent).mockResolvedValue(5000);
    expect(await getBackfillBudgetStep()).toBe(0);
  });
});
