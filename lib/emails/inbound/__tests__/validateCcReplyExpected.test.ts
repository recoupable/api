import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateCcReplyExpected } from "../validateCcReplyExpected";
import type { ResendEmailData } from "@/lib/emails/validateInboundEmailEvent";

// Mock the shouldReplyToCcEmail function
vi.mock("@/lib/emails/inbound/shouldReplyToCcEmail", () => ({
  shouldReplyToCcEmail: vi.fn(),
}));

import { shouldReplyToCcEmail } from "@/lib/emails/inbound/shouldReplyToCcEmail";

const mockShouldReply = vi.mocked(shouldReplyToCcEmail);

describe("validateCcReplyExpected", () => {
  const baseEmailData: ResendEmailData = {
    email_id: "test-123",
    created_at: "2024-01-01T00:00:00Z",
    from: "sender@example.com",
    to: [],
    cc: [],
    bcc: [],
    message_id: "<test@example.com>",
    subject: "Test Subject",
    attachments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always calls shouldReplyToCcEmail regardless of TO/CC", async () => {
    mockShouldReply.mockResolvedValue(true);

    const emailData: ResendEmailData = {
      ...baseEmailData,
      to: ["hi@mail.recoupable.com"],
      cc: [],
    };

    await validateCcReplyExpected(emailData, "Hello");

    expect(mockShouldReply).toHaveBeenCalledTimes(1);
  });

  it("returns null when shouldReplyToCcEmail returns true", async () => {
    mockShouldReply.mockResolvedValue(true);

    const emailData: ResendEmailData = {
      ...baseEmailData,
      to: ["hi@mail.recoupable.com"],
      cc: [],
    };

    const result = await validateCcReplyExpected(emailData, "Hello");

    expect(result).toBeNull();
  });

  it("returns response when shouldReplyToCcEmail returns false", async () => {
    mockShouldReply.mockResolvedValue(false);

    const emailData: ResendEmailData = {
      ...baseEmailData,
      to: ["someone@example.com"],
      cc: ["hi@mail.recoupable.com"],
    };

    const result = await validateCcReplyExpected(emailData, "FYI");

    expect(result).not.toBeNull();
    expect(result?.response).toBeDefined();
  });

  it("passes correct params to shouldReplyToCcEmail", async () => {
    mockShouldReply.mockResolvedValue(true);

    const emailData: ResendEmailData = {
      ...baseEmailData,
      from: "test@example.com",
      to: ["hi@mail.recoupable.com"],
      cc: ["cc@example.com"],
      subject: "Test",
    };

    await validateCcReplyExpected(emailData, "Email body");

    expect(mockShouldReply).toHaveBeenCalledWith({
      from: "test@example.com",
      to: ["hi@mail.recoupable.com"],
      cc: ["cc@example.com"],
      subject: "Test",
      body: "Email body",
    });
  });
});
