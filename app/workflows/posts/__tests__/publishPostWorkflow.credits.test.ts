import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishPostWorkflow } from "../publishPostWorkflow";
import { publishPostStep } from "../publishPostStep";
import { markPostStep } from "../markPostStep";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("workflow", () => ({ sleep: vi.fn() }));
vi.mock("../publishPostStep", () => ({ publishPostStep: vi.fn() }));
vi.mock("../markPostStep", () => ({ markPostStep: vi.fn() }));
vi.mock("../claimScheduledPostStep", () => ({ claimScheduledPostStep: vi.fn() }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));

const params = { accountId: "acct", platform: "linkedin" as const, creditsToCharge: 10_000 };

describe("publishPostWorkflow credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markPostStep).mockResolvedValue({} as never);
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });
  });

  it("charges the quoted price once the post is posted", async () => {
    vi.mocked(publishPostStep).mockResolvedValue({
      postUrl: "https://www.linkedin.com/feed/update/urn:li:ugcPost:1/",
      textVerified: true,
    });
    await publishPostWorkflow("p1", params);
    expect(recordCreditDeduction).toHaveBeenCalledTimes(1);
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acct",
      creditsToDeduct: 10_000,
      source: "api",
      provider: "composio",
      modelId: "posts/linkedin",
      resourceUrl: "https://www.linkedin.com/feed/update/urn:li:ugcPost:1/",
    });
    expect(vi.mocked(markPostStep).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(recordCreditDeduction).mock.invocationCallOrder[0],
    );
  });

  it("charges nothing when the post fails", async () => {
    vi.mocked(publishPostStep).mockRejectedValue(new Error("quotaExceeded"));
    await publishPostWorkflow("p1", params);
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });
});
