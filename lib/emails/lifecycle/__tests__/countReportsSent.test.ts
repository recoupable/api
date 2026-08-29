import { describe, it, expect, vi } from "vitest";

const { selectLogMock } = vi.hoisted(() => ({ selectLogMock: vi.fn() }));
vi.mock("@/lib/supabase/email_send_log/selectEmailSendLog", () => ({
  selectEmailSendLog: selectLogMock,
}));

const { countReportsSent } = await import("../countReportsSent");

describe("countReportsSent", () => {
  it("counts sent rows since the date, excluding lifecycle-marker rows", async () => {
    selectLogMock.mockResolvedValue([
      { raw_body: '{"to":"a@x.com","subject":"Weekly"}' },
      { raw_body: '{"type":"welcome_email","to":"a@x.com"}' },
      { raw_body: '{"type":"valuation_report","snapshot_id":"s1"}' },
      { raw_body: '{"type":"trial_ending_email","subscription_id":"sub_1"}' },
      { raw_body: null },
    ]);
    expect(await countReportsSent("acc_1", "2026-08-01T00:00:00Z")).toBe(3);
    expect(selectLogMock).toHaveBeenCalledWith({
      accountId: "acc_1",
      status: "sent",
      createdAfter: "2026-08-01T00:00:00Z",
    });
  });
});
