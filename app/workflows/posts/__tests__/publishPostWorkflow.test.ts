import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishPostWorkflow } from "../publishPostWorkflow";
import { publishPostStep } from "../publishPostStep";
import { markPostStep } from "../markPostStep";

vi.mock("workflow", () => ({ sleep: vi.fn() }));
vi.mock("../publishPostStep", () => ({ publishPostStep: vi.fn() }));
vi.mock("../markPostStep", () => ({ markPostStep: vi.fn() }));
vi.mock("../claimScheduledPostStep", () => ({ claimScheduledPostStep: vi.fn() }));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(async () => ({ success: true })),
}));

const params = { accountId: "acct", platform: "x" as const, creditsToCharge: 10_000 };

describe("publishPostWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markPostStep).mockResolvedValue({} as never);
  });

  it("marks the post posted with its URL and text check", async () => {
    vi.mocked(publishPostStep).mockResolvedValue({
      postUrl: "https://x.com/i/status/1",
      textVerified: true,
    });
    const result = await publishPostWorkflow("p1", params);
    expect(markPostStep).toHaveBeenCalledWith("p1", {
      status: "posted",
      post_url: "https://x.com/i/status/1",
      text_verified: true,
    });
    expect(result).toEqual({ success: true, postId: "p1", postUrl: "https://x.com/i/status/1" });
  });

  it("marks the post failed with the platform's message", async () => {
    vi.mocked(publishPostStep).mockRejectedValue(
      new Error("YOUTUBE_MULTIPART_UPLOAD_VIDEO failed: quotaExceeded"),
    );
    const result = await publishPostWorkflow("p1", params);
    expect(markPostStep).toHaveBeenCalledWith("p1", {
      status: "failed",
      error_message: "YOUTUBE_MULTIPART_UPLOAD_VIDEO failed: quotaExceeded",
    });
    expect(result.success).toBe(false);
  });

  it("never marks a live post failed when recording it fails", async () => {
    vi.mocked(publishPostStep).mockResolvedValue({
      postUrl: "https://x.com/i/status/1",
      textVerified: false,
    });
    vi.mocked(markPostStep).mockRejectedValue(new Error("db down"));
    await expect(publishPostWorkflow("p1", params)).rejects.toThrow("db down");
    expect(markPostStep).not.toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ status: "failed" }),
    );
  });
});
