import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendApifyWebhookEmail } from "@/lib/apify/sendApifyWebhookEmail";
import { RECOUP_FROM_EMAIL } from "@/lib/const";

vi.mock("@/lib/ai/generateText", () => ({
  default: vi.fn(async () => ({ text: "<p>body</p>" })),
}));
const sendEmailWithResend = vi.fn();
vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: (...a: unknown[]) => sendEmailWithResend(...a),
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

beforeEach(() => {
  vi.clearAllMocks();
  sendEmailWithResend.mockResolvedValue({ id: "email-1" });
});

describe("sendApifyWebhookEmail", () => {
  it("BCCs recipients so no account can see another's address (chat#1855)", async () => {
    const recipients = [
      "manager@customer-a.com",
      "label@customer-b.com",
      "internal@recoupable.com",
    ];
    await sendApifyWebhookEmail(PROFILE, recipients);
    const payload = sendEmailWithResend.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.bcc).toEqual(recipients);
    expect(payload.to).toEqual([RECOUP_FROM_EMAIL]);
  });

  it("never carries more than our own address in to/cc, regardless of recipient count", async () => {
    const recipients = Array.from({ length: 25 }, (_, i) => `user${i}@example.com`);
    await sendApifyWebhookEmail(PROFILE, recipients);
    const payload = sendEmailWithResend.mock.calls[0][0] as Record<string, unknown>;
    const visible = [payload.to, payload.cc].flat().filter(Boolean);
    expect(visible).toEqual([RECOUP_FROM_EMAIL]);
  });

  it("returns null and sends nothing when there are no recipients", async () => {
    expect(await sendApifyWebhookEmail(PROFILE, [])).toBeNull();
    expect(sendEmailWithResend).not.toHaveBeenCalled();
  });
});
