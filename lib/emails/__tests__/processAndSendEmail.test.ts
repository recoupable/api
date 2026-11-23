import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { processAndSendEmail } from "../processAndSendEmail";

const mockSendEmailWithResend = vi.fn();
const mockSelectRoomWithArtist = vi.fn();

vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: (...args: unknown[]) => mockSendEmailWithResend(...args),
}));

vi.mock("@/lib/supabase/rooms/selectRoomWithArtist", () => ({
  selectRoomWithArtist: (...args: unknown[]) => mockSelectRoomWithArtist(...args),
}));

describe("processAndSendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email with text body converted to HTML", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-123" });

    const result = await processAndSendEmail({
      to: ["user@example.com"],
      subject: "Test",
      text: "Hello world",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.id).toBe("email-123");
      expect(result.message).toContain("user@example.com");
    }
    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Agent by Recoup <agent@recoupable.dev>",
        to: ["user@example.com"],
        subject: "Test",
        html: expect.stringContaining("Hello world"),
      }),
      undefined,
    );
  });

  it("uses html body when provided (takes precedence over text)", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-456" });

    await processAndSendEmail({
      to: ["user@example.com"],
      subject: "Test",
      text: "plain text",
      html: "<h1>HTML body</h1>",
    });

    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("<h1>HTML body</h1>"),
      }),
      undefined,
    );
  });

  it("includes CC when provided", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-789" });

    await processAndSendEmail({
      to: ["user@example.com"],
      cc: ["cc@example.com"],
      subject: "Test",
    });

    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: ["cc@example.com"],
      }),
      undefined,
    );
  });

  it("includes artist name in footer when room_id is provided", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-room" });
    mockSelectRoomWithArtist.mockResolvedValue({ artist_name: "Test Artist" });

    await processAndSendEmail({
      to: ["user@example.com"],
      subject: "Test",
      text: "Hello",
      room_id: "room-abc",
    });

    expect(mockSelectRoomWithArtist).toHaveBeenCalledWith("room-abc");
    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Test Artist"),
      }),
      undefined,
    );
  });

  it("wraps the email in the shared house-style layout (weekly-report consistency pass)", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-layout" });

    await processAndSendEmail({
      to: ["user@example.com"],
      subject: "Weekly report",
      html: "<h1>This week</h1>",
    });

    const sent = mockSendEmailWithResend.mock.calls[0][0] as { html: string };
    // Body preserved…
    expect(sent.html).toContain("<h1>This week</h1>");
    // …inside the shared layout: Recoup wordmark header + shadow-as-border card.
    expect(sent.html).toContain("Recoup");
    expect(sent.html).toContain("box-shadow");
    expect(sent.html).toContain("Plus Jakarta Sans");
  });

  it("returns error when Resend fails", async () => {
    const errorResponse = NextResponse.json(
      { error: { message: "Rate limited" } },
      { status: 429 },
    );
    mockSendEmailWithResend.mockResolvedValue(errorResponse);

    const result = await processAndSendEmail({
      to: ["user@example.com"],
      subject: "Test",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Rate limited");
    }
  });

  it("forwards idempotencyKey to Resend so a replayed send delivers once (chat#1918)", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "resend-1" });
    await processAndSendEmail({
      to: ["a@b.com"],
      subject: "S",
      text: "body",
      idempotencyKey: "chat_1:msg_2",
    });
    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: "chat_1:msg_2" }),
    );
  });

  it("omits Resend options entirely when no idempotencyKey is given", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "resend-2" });
    await processAndSendEmail({ to: ["a@b.com"], subject: "S", text: "body" });
    expect(mockSendEmailWithResend).toHaveBeenCalledWith(expect.anything(), undefined);
  });
});
