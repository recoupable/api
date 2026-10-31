import { beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { publishPostWorkflow } from "../publishPostWorkflow";
import { publishPostStep } from "../publishPostStep";
import { markPostStep } from "../markPostStep";
import { claimScheduledPostStep } from "../claimScheduledPostStep";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("workflow", () => ({ sleep: vi.fn() }));
vi.mock("../publishPostStep", () => ({ publishPostStep: vi.fn() }));
vi.mock("../markPostStep", () => ({ markPostStep: vi.fn() }));
vi.mock("../claimScheduledPostStep", () => ({ claimScheduledPostStep: vi.fn() }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));

const publishAt = "2099-01-01T15:00:00Z";
const params = { accountId: "acct", platform: "x" as const, creditsToCharge: 10_000 };

describe("publishPostWorkflow scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markPostStep).mockResolvedValue({} as never);
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });
    vi.mocked(publishPostStep).mockResolvedValue({
      postUrl: "https://x.com/i/1",
      textVerified: true,
    });
  });

  it("sleeps until publish_at, claims the row, then publishes", async () => {
    vi.mocked(claimScheduledPostStep).mockResolvedValue(true);
    const result = await publishPostWorkflow("p1", { ...params, publishAt });
    expect(sleep).toHaveBeenCalledWith(new Date(publishAt));
    expect(claimScheduledPostStep).toHaveBeenCalledWith("p1");
    expect(vi.mocked(sleep).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(claimScheduledPostStep).mock.invocationCallOrder[0],
    );
    expect(publishPostStep).toHaveBeenCalledWith("p1");
    expect(result.success).toBe(true);
  });

  it("stops without publishing, marking or charging when the post was cancelled", async () => {
    vi.mocked(claimScheduledPostStep).mockResolvedValue(false);
    const result = await publishPostWorkflow("p1", { ...params, publishAt });
    expect(publishPostStep).not.toHaveBeenCalled();
    expect(markPostStep).not.toHaveBeenCalled();
    expect(recordCreditDeduction).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, cancelled: true });
  });

  it("publishes immediately without sleeping or claiming when there is no publish time", async () => {
    await publishPostWorkflow("p1", params);
    expect(sleep).not.toHaveBeenCalled();
    expect(claimScheduledPostStep).not.toHaveBeenCalled();
    expect(publishPostStep).toHaveBeenCalledWith("p1");
  });
});
