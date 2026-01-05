import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateCcReplyExpected } from "../validateCcReplyExpected";
import type { ResendEmailData } from "@/lib/emails/validateInboundEmailEvent";

const mockGenerate = vi.fn();

// Mock the EmailReplyAgent
vi.mock("@/lib/agents/EmailReplyAgent", () => ({
  createEmailReplyAgent: vi.fn().mockImplementation(() => ({
    generate: mockGenerate,
  })),
}));

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

  it("always calls agent.generate regardless of TO/CC", async () => {
    mockGenerate.mockResolvedValue({ output: { shouldReply: true } });

    const emailData: ResendEmailData = {
      ...baseEmailData,
      to: ["hi@mail.recoupable.com"],
      cc: [],
    };

    await validateCcReplyExpected(emailData, "Hello");

    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("returns null when agent returns shouldReply: true", async () => {
    mockGenerate.mockResolvedValue({ output: { shouldReply: true } });

    const emailData: ResendEmailData = {
      ...baseEmailData,
      to: ["hi@mail.recoupable.com"],
      cc: [],
    };

    const result = await validateCcReplyExpected(emailData, "Hello");

    expect(result).toBeNull();
  });

  it("returns response when agent returns shouldReply: false", async () => {
    mockGenerate.mockResolvedValue({ output: { shouldReply: false } });

    const emailData: ResendEmailData = {
      ...baseEmailData,
      to: ["someone@example.com"],
      cc: ["hi@mail.recoupable.com"],
    };

    const result = await validateCcReplyExpected(emailData, "FYI");

    expect(result).not.toBeNull();
    expect(result?.response).toBeDefined();
  });

  it("passes email context in prompt to agent.generate", async () => {
    mockGenerate.mockResolvedValue({ output: { shouldReply: true } });

    const emailData: ResendEmailData = {
      ...baseEmailData,
      from: "test@example.com",
      to: ["hi@mail.recoupable.com"],
      cc: ["cc@example.com"],
      subject: "Test Subject",
    };

    await validateCcReplyExpected(emailData, "Email body");

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("test@example.com"),
      }),
    );
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Email body"),
      }),
    );
  });
});
