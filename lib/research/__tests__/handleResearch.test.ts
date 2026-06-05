import { describe, it, expect, vi, beforeEach } from "vitest";

import { handleResearch } from "../handleResearch";
import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/research/songstats/fetchSongstatsResearch", () => ({
  fetchSongstatsResearch: vi.fn(),
}));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(),
}));

describe("handleResearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { data } on 200 and deducts the default 5 credits", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({
      status: 200,
      data: [{ id: 1 }],
    } as never);
    vi.mocked(recordCreditDeduction).mockResolvedValue(undefined as never);

    const result = await handleResearch({
      accountId: "acc_1",
      path: "/search",
      query: { q: "Drake", type: "artists" },
    });

    expect(fetchSongstatsResearch).toHaveBeenCalledWith("/search", {
      q: "Drake",
      type: "artists",
    });
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 5,
      source: "api",
    });
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  it("returns { error, status } when proxy is non-200 and skips deduction", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 502, data: null } as never);

    const result = await handleResearch({
      accountId: "acc_1",
      path: "/search",
      query: { q: "Drake" },
    });

    expect(result).toEqual({ error: "Request failed with status 502", status: 502 });
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });

  it("still returns { data } when credit deduction throws", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 200, data: "ok" } as never);
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("DB down"));

    const result = await handleResearch({
      accountId: "acc_1",
      path: "/x",
    });

    expect(result).toEqual({ data: "ok" });
  });

  it("respects the credits override", async () => {
    vi.mocked(fetchSongstatsResearch).mockResolvedValue({ status: 200, data: {} } as never);
    vi.mocked(recordCreditDeduction).mockResolvedValue(undefined as never);

    await handleResearch({
      accountId: "acc_1",
      path: "/x",
      credits: 12,
    });

    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 12,
      source: "api",
    });
  });
});
