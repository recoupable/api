import { describe, it, expect, vi, beforeEach } from "vitest";

import { handleResearch } from "../handleResearch";
import { fetchChartmetric } from "@/lib/research/fetchChartmetric";
import { deductCredits } from "@/lib/credits/deductCredits";

vi.mock("@/lib/research/fetchChartmetric", () => ({
  fetchChartmetric: vi.fn(),
}));
vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

describe("handleResearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { data } on 200 and deducts the default 5 credits", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({
      status: 200,
      data: [{ id: 1 }],
    } as never);
    vi.mocked(deductCredits).mockResolvedValue(undefined as never);

    const result = await handleResearch({
      accountId: "acc_1",
      path: "/charts/spotify",
      query: { country_code: "US" },
    });

    expect(fetchChartmetric).toHaveBeenCalledWith("/charts/spotify", { country_code: "US" });
    expect(deductCredits).toHaveBeenCalledWith({ accountId: "acc_1", creditsToDeduct: 5 });
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  it("returns { error, status } when proxy is non-200 and skips deduction", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({ status: 502, data: null } as never);

    const result = await handleResearch({
      accountId: "acc_1",
      path: "/charts/spotify",
    });

    expect(result).toEqual({ error: "Request failed with status 502", status: 502 });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("still returns { data } when credit deduction throws", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({ status: 200, data: "ok" } as never);
    vi.mocked(deductCredits).mockRejectedValue(new Error("DB down"));

    const result = await handleResearch({
      accountId: "acc_1",
      path: "/x",
    });

    expect(result).toEqual({ data: "ok" });
  });

  it("respects the credits override", async () => {
    vi.mocked(fetchChartmetric).mockResolvedValue({ status: 200, data: {} } as never);
    vi.mocked(deductCredits).mockResolvedValue(undefined as never);

    await handleResearch({
      accountId: "acc_1",
      path: "/x",
      credits: 12,
    });

    expect(deductCredits).toHaveBeenCalledWith({ accountId: "acc_1", creditsToDeduct: 12 });
  });
});
