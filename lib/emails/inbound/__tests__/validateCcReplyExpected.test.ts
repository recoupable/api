import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateCcReplyExpected } from "../validateCcReplyExpected";
import type { ResendEmailData } from "@/lib/emails/validateInboundEmailEvent";
import { RECOUP_EMAIL_DOMAIN } from "@/lib/const";

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

  describe("when recoup email is only in TO (not CC)", () => {
    it("skips agent call and returns null (always reply)", async () => {
      const emailData: ResendEmailData = {
        ...baseEmailData,
        to: [`hi${RECOUP_EMAIL_DOMAIN}`],
        cc: [],
      };

      const result = await validateCcReplyExpected(emailData, "Hello");

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("handles multiple TO addresses with recoup email", async () => {
      const emailData: ResendEmailData = {
        ...baseEmailData,
        to: ["other@example.com", `hi${RECOUP_EMAIL_DOMAIN}`],
        cc: [],
      };

      const result = await validateCcReplyExpected(emailData, "Hello");

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("when recoup email is only in CC", () => {
    it("calls agent to determine if reply is expected", async () => {
      mockGenerate.mockResolvedValue({ output: { shouldReply: true } });

      const emailData: ResendEmailData = {
        ...baseEmailData,
        to: ["someone@example.com"],
        cc: [`hi${RECOUP_EMAIL_DOMAIN}`],
      };

      await validateCcReplyExpected(emailData, "FYI");

      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it("returns null when agent returns shouldReply: true", async () => {
      mockGenerate.mockResolvedValue({ output: { shouldReply: true } });

      const emailData: ResendEmailData = {
        ...baseEmailData,
        to: ["someone@example.com"],
        cc: [`hi${RECOUP_EMAIL_DOMAIN}`],
      };

      const result = await validateCcReplyExpected(emailData, "Please review");

      expect(result).toBeNull();
    });

    it("returns response when agent returns shouldReply: false", async () => {
      mockGenerate.mockResolvedValue({ output: { shouldReply: false } });

      const emailData: ResendEmailData = {
        ...baseEmailData,
        to: ["someone@example.com"],
        cc: [`hi${RECOUP_EMAIL_DOMAIN}`],
      };

      const result = await validateCcReplyExpected(emailData, "FYI");

      expect(result).not.toBeNull();
      expect(result?.response).toBeDefined();
    });
  });

  describe("when recoup email is in both TO and CC", () => {
    it("treats as CC and calls agent", async () => {
      mockGenerate.mockResolvedValue({ output: { shouldReply: true } });

      const emailData: ResendEmailData = {
        ...baseEmailData,
        to: [`hi${RECOUP_EMAIL_DOMAIN}`],
        cc: [`hi${RECOUP_EMAIL_DOMAIN}`],
      };

      await validateCcReplyExpected(emailData, "Hello");

      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it("returns null when agent returns shouldReply: true", async () => {
      mockGenerate.mockResolvedValue({ output: { shouldReply: true } });

      const emailData: ResendEmailData = {
        ...baseEmailData,
        to: [`hi${RECOUP_EMAIL_DOMAIN}`],
        cc: [`hi${RECOUP_EMAIL_DOMAIN}`],
      };

      const result = await validateCcReplyExpected(emailData, "Hello");

      expect(result).toBeNull();
    });

    it("returns response when agent returns shouldReply: false", async () => {
      mockGenerate.mockResolvedValue({ output: { shouldReply: false } });

      const emailData: ResendEmailData = {
        ...baseEmailData,
        to: [`hi${RECOUP_EMAIL_DOMAIN}`],
        cc: [`hi${RECOUP_EMAIL_DOMAIN}`],
      };

      const result = await validateCcReplyExpected(emailData, "FYI");

      expect(result).not.toBeNull();
      expect(result?.response).toBeDefined();
    });
  });

  it("passes email context in prompt to agent.generate", async () => {
    mockGenerate.mockResolvedValue({ output: { shouldReply: true } });

    const emailData: ResendEmailData = {
      ...baseEmailData,
      from: "test@example.com",
      to: ["someone@example.com"],
      cc: [`hi${RECOUP_EMAIL_DOMAIN}`, "cc@example.com"],
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
