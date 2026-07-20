import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { sendValuationReportEmail } from "../sendValuationReportEmail";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { selectValuationEmailSendLog } from "@/lib/supabase/email_send_log/selectValuationEmailSendLog";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectCatalogById } from "@/lib/supabase/catalogs/selectCatalogById";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { getCatalogEarliestReleaseDate } from "@/lib/catalog/getCatalogEarliestReleaseDate";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import type { Tables } from "@/types/database.types";

vi.mock("@/lib/emails/sendEmail", () => ({ sendEmailWithResend: vi.fn() }));
vi.mock("@/lib/emails/logEmailAttempt", () => ({ logEmailAttempt: vi.fn() }));
vi.mock("@/lib/supabase/email_send_log/selectValuationEmailSendLog", () => ({
  selectValuationEmailSendLog: vi.fn(),
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/catalogs/selectCatalogById", () => ({ selectCatalogById: vi.fn() }));
vi.mock("@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate", () => ({
  selectCatalogMeasurementsAggregate: vi.fn(),
}));
vi.mock("@/lib/catalog/getCatalogEarliestReleaseDate", () => ({
  getCatalogEarliestReleaseDate: vi.fn(),
}));

const snapshot = {
  id: "snap_1",
  account: "acc_1",
  catalog: "cat_1",
  album_count: 10,
  state: "done",
} as Tables<"playcount_snapshots">;

function arrange() {
  vi.mocked(selectValuationEmailSendLog).mockResolvedValue(null);
  vi.mocked(selectAccountEmails).mockResolvedValue([
    { email: "digital@epitaph.com", account_id: "acc_1" } as Tables<"account_emails">,
  ]);
  vi.mocked(selectCatalogById).mockResolvedValue({
    id: "cat_1",
    name: "Epitaph Catalog",
  } as Tables<"catalogs">);
  vi.mocked(selectCatalogMeasurementsAggregate).mockResolvedValue({
    measuredSongCount: 112,
    totalStreams: 3_480_000,
  });
  vi.mocked(getCatalogEarliestReleaseDate).mockResolvedValue("2016-01-01");
  vi.mocked(sendEmailWithResend).mockResolvedValue({ id: "resend_1" });
}

describe("sendValuationReportEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrange();
  });

  it("sends the report with a per-snapshot idempotency key and logs the send", async () => {
    const result = await sendValuationReportEmail(snapshot);

    expect(sendEmailWithResend).toHaveBeenCalledTimes(1);
    const [payload, options] = vi.mocked(sendEmailWithResend).mock.calls[0];
    expect(payload.from).toBe(RECOUP_FROM_EMAIL);
    expect(payload.to).toEqual(["digital@epitaph.com"]);
    expect(payload.subject).toBe("Your catalog valuation is ready");
    expect(payload.html).toContain("Epitaph Catalog");
    expect(payload.html).toContain("https://chat.recoupable.dev/catalogs/cat_1");
    expect(options).toEqual({ idempotencyKey: "valuation-report/snap_1" });

    expect(logEmailAttempt).toHaveBeenCalledTimes(1);
    const attempt = vi.mocked(logEmailAttempt).mock.calls[0][0];
    expect(attempt.status).toBe("sent");
    expect(attempt.accountId).toBe("acc_1");
    expect(attempt.resendId).toBe("resend_1");
    expect(attempt.rawBody).toContain('"snapshot_id":"snap_1"');
    expect(attempt.rawBody).toContain('"type":"valuation_report"');

    expect(result).toEqual({ sent: true, resendId: "resend_1" });
  });

  it("skips without sending when a send is already logged for this snapshot", async () => {
    vi.mocked(selectValuationEmailSendLog).mockResolvedValue({
      id: "log_1",
    } as Tables<"email_send_log">);

    const result = await sendValuationReportEmail(snapshot);

    expect(sendEmailWithResend).not.toHaveBeenCalled();
    expect(logEmailAttempt).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, skipped: "already_sent" });
  });

  it("skips when the account has no email address", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await sendValuationReportEmail(snapshot);

    expect(sendEmailWithResend).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, skipped: "no_email" });
  });

  it("falls back to the app link and album count when no catalog was claimed", async () => {
    const result = await sendValuationReportEmail({ ...snapshot, catalog: null });

    expect(selectCatalogById).not.toHaveBeenCalled();
    expect(selectCatalogMeasurementsAggregate).not.toHaveBeenCalled();
    const [payload] = vi.mocked(sendEmailWithResend).mock.calls[0];
    expect(payload.html).toContain('href="https://chat.recoupable.dev"');
    expect(payload.html).not.toContain("/catalogs/");
    expect(result).toEqual({ sent: true, resendId: "resend_1" });
  });

  it("logs send_failed and reports the failure when Resend rejects the send", async () => {
    vi.mocked(sendEmailWithResend).mockResolvedValue(
      NextResponse.json({ error: "Failed to send email" }, { status: 502 }),
    );

    const result = await sendValuationReportEmail(snapshot);

    const attempt = vi.mocked(logEmailAttempt).mock.calls[0][0];
    expect(attempt.status).toBe("send_failed");
    expect(result).toEqual({ sent: false, error: "Failed to send email" });
  });
});
