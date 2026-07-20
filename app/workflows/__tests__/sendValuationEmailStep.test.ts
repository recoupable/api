import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendValuationEmailStep } from "../sendValuationEmailStep";
import { sendValuationReportEmail } from "@/lib/emails/valuationReport/sendValuationReportEmail";
import type { Tables } from "@/types/database.types";

vi.mock("@/lib/emails/valuationReport/sendValuationReportEmail", () => ({
  sendValuationReportEmail: vi.fn(),
}));

const snapshot = { id: "snap_1", account: "acc_1" } as Tables<"playcount_snapshots">;

describe("sendValuationEmailStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to sendValuationReportEmail", async () => {
    vi.mocked(sendValuationReportEmail).mockResolvedValue({ sent: true, resendId: "resend_1" });

    await sendValuationEmailStep(snapshot);

    expect(sendValuationReportEmail).toHaveBeenCalledWith(snapshot);
  });

  it("never throws: an email failure must not fail a completed snapshot", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendValuationReportEmail).mockRejectedValue(new Error("resend down"));

    await expect(sendValuationEmailStep(snapshot)).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
