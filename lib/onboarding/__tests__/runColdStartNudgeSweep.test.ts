import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectEmailSendLog = vi.fn();
const mockSelectRosteredAccountIds = vi.fn();
const mockSendColdStartNudgeEmail = vi.fn();

vi.mock("@/lib/supabase/email_send_log/selectEmailSendLog", () => ({
  selectEmailSendLog: (...args: unknown[]) => mockSelectEmailSendLog(...args),
}));
vi.mock("@/lib/supabase/account_artist_ids/selectRosteredAccountIds", () => ({
  selectRosteredAccountIds: (...args: unknown[]) => mockSelectRosteredAccountIds(...args),
}));
vi.mock("@/lib/emails/sendColdStartNudgeEmail", () => ({
  sendColdStartNudgeEmail: (...args: unknown[]) => mockSendColdStartNudgeEmail(...args),
}));

const { runColdStartNudgeSweep } = await import("../runColdStartNudgeSweep");

const NOW = new Date("2026-07-27T15:00:00.000Z");

describe("runColdStartNudgeSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSendColdStartNudgeEmail.mockResolvedValue(true);
  });

  it("nudges only welcomed accounts with no roster", async () => {
    mockSelectEmailSendLog
      .mockResolvedValueOnce([
        { account_id: "cold-1" },
        { account_id: "activated" },
        { account_id: "cold-2" },
      ])
      .mockResolvedValueOnce([]);
    mockSelectRosteredAccountIds.mockResolvedValue(["activated"]);

    const result = await runColdStartNudgeSweep(NOW);

    expect(result).toEqual({ welcomed: 3, coldStart: 2, sent: 2 });
    expect(mockSendColdStartNudgeEmail).toHaveBeenCalledWith({
      accountId: "cold-1",
    });
    expect(mockSendColdStartNudgeEmail).not.toHaveBeenCalledWith({
      accountId: "activated",
    });
  });

  it("skips an account already nudged, so a cron retry cannot double-send", async () => {
    mockSelectEmailSendLog
      .mockResolvedValueOnce([{ account_id: "cold-1" }])
      .mockResolvedValueOnce([{ account_id: "cold-1" }]);
    mockSelectRosteredAccountIds.mockResolvedValue([]);

    const result = await runColdStartNudgeSweep(NOW);

    expect(result.sent).toBe(0);
    expect(mockSendColdStartNudgeEmail).not.toHaveBeenCalled();
  });

  it("reads a 1-to-14-day window, so it waits a day and stops after two weeks", async () => {
    mockSelectEmailSendLog.mockResolvedValue([]);

    await runColdStartNudgeSweep(NOW);

    expect(mockSelectEmailSendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        createdAfter: "2026-07-13T15:00:00.000Z",
        createdBefore: "2026-07-26T15:00:00.000Z",
      }),
    );
  });

  it("does nothing when no account was welcomed in the window", async () => {
    mockSelectEmailSendLog.mockResolvedValue([]);

    const result = await runColdStartNudgeSweep(NOW);

    expect(result).toEqual({ welcomed: 0, coldStart: 0, sent: 0 });
    expect(mockSelectRosteredAccountIds).not.toHaveBeenCalled();
  });

  it("counts only sends that actually went out", async () => {
    mockSelectEmailSendLog
      .mockResolvedValueOnce([{ account_id: "a" }, { account_id: "b" }])
      .mockResolvedValueOnce([]);
    mockSelectRosteredAccountIds.mockResolvedValue([]);
    // e.g. a wallet-only account with no email address
    mockSendColdStartNudgeEmail.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await runColdStartNudgeSweep(NOW);

    expect(result).toEqual({ welcomed: 2, coldStart: 2, sent: 1 });
  });
});
