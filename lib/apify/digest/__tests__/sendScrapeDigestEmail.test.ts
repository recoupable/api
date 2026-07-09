import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendScrapeDigestEmail } from "@/lib/apify/digest/sendScrapeDigestEmail";
import { renderScrapeDigestHtml } from "@/lib/apify/digest/renderScrapeDigestHtml";
import { RECOUP_FROM_EMAIL } from "@/lib/const";

const sendEmailWithResend = vi.fn();
vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: (...a: unknown[]) => sendEmailWithResend(...a),
}));
vi.mock("@/lib/composio/getFrontendBaseUrl", () => ({
  getFrontendBaseUrl: () => "https://chat.recoupable.dev",
}));

const SECTIONS = [
  { platform: "instagram", postUrls: ["https://instagram.com/p/a", "https://instagram.com/p/b"] },
  { platform: "tiktok", postUrls: ["https://tiktok.com/@x/video/1"] },
];

beforeEach(() => {
  vi.clearAllMocks();
  sendEmailWithResend.mockResolvedValue({ id: "email-1" });
});

describe("sendScrapeDigestEmail", () => {
  it("sends the deterministic renderer's output, not an ad-hoc body (chat#1855)", async () => {
    await sendScrapeDigestEmail({ emails: ["a@b.com"], sections: SECTIONS, artistName: "Nat" });
    const payload = sendEmailWithResend.mock.calls[0][0] as Record<string, unknown>;
    const rendered = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Nat" });
    expect(payload.subject).toBe(rendered.subject);
    expect(payload.html).toBe(rendered.html);
  });

  it("BCCs recipients so no account can see another's address", async () => {
    const recipients = ["a@b.com", "c@d.com"];
    await sendScrapeDigestEmail({ emails: recipients, sections: SECTIONS });
    const payload = sendEmailWithResend.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.bcc).toEqual(recipients);
    expect(payload.to).toEqual([RECOUP_FROM_EMAIL]);
  });

  it("sends nothing without recipients or sections", async () => {
    expect(await sendScrapeDigestEmail({ emails: [], sections: SECTIONS })).toBeNull();
    expect(await sendScrapeDigestEmail({ emails: ["a@b.com"], sections: [] })).toBeNull();
    expect(sendEmailWithResend).not.toHaveBeenCalled();
  });
});
