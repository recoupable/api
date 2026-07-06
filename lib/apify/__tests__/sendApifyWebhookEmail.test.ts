import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendApifyWebhookEmail } from "@/lib/apify/sendApifyWebhookEmail";
import { RECOUP_FROM_EMAIL } from "@/lib/const";

const sendEmailWithResend = vi.fn();
vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: (...a: unknown[]) => sendEmailWithResend(...a),
}));
vi.mock("@/lib/composio/getFrontendBaseUrl", () => ({
  getFrontendBaseUrl: () => "https://chat.recoupable.dev",
}));

const PROFILE = {
  fullName: "Ashnikko",
  username: "ashnikko",
  url: "https://instagram.com/ashnikko",
  profilePicUrl: "https://example.com/pic.jpg",
  biography: "bio",
  followersCount: 100,
  followsCount: 10,
  latestPosts: [],
} as never;
const NEW_URLS = ["https://instagram.com/p/new1"];

beforeEach(() => {
  vi.clearAllMocks();
  sendEmailWithResend.mockResolvedValue({ id: "email-1" });
});

describe("sendApifyWebhookEmail", () => {
  it("BCCs recipients so no account can see another's address (chat#1855)", async () => {
    const recipients = ["manager@customer-a.com", "label@customer-b.com"];
    await sendApifyWebhookEmail(PROFILE, recipients, NEW_URLS);
    const payload = sendEmailWithResend.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.bcc).toEqual(recipients);
    expect(payload.to).toEqual([RECOUP_FROM_EMAIL]);
  });

  it("never carries more than our own address in to/cc, regardless of recipient count", async () => {
    const recipients = Array.from({ length: 25 }, (_, i) => `user${i}@example.com`);
    await sendApifyWebhookEmail(PROFILE, recipients, NEW_URLS);
    const payload = sendEmailWithResend.mock.calls[0][0] as Record<string, unknown>;
    expect([payload.to, payload.cc].flat().filter(Boolean)).toEqual([RECOUP_FROM_EMAIL]);
  });

  it("links the new posts in the deterministic body — no vendor jargon", async () => {
    await sendApifyWebhookEmail(PROFILE, ["a@b.com"], NEW_URLS);
    const payload = sendEmailWithResend.mock.calls[0][0] as Record<string, string>;
    expect(payload.html).toContain('href="https://instagram.com/p/new1"');
    expect((payload.html + payload.subject).toLowerCase()).not.toContain("apify");
  });

  it("returns null and sends nothing when there are no recipients", async () => {
    expect(await sendApifyWebhookEmail(PROFILE, [], NEW_URLS)).toBeNull();
    expect(sendEmailWithResend).not.toHaveBeenCalled();
  });

  it("returns null and sends nothing when no post is genuinely new", async () => {
    expect(await sendApifyWebhookEmail(PROFILE, ["a@b.com"], [])).toBeNull();
    expect(sendEmailWithResend).not.toHaveBeenCalled();
  });
});
