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

const mockGetCatalogValuationDelta = vi.fn();
vi.mock("@/lib/catalog/getCatalogValuationDelta", () => ({
  getCatalogValuationDelta: (...args: unknown[]) => mockGetCatalogValuationDelta(...args),
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

  // chat#1911 row 5: a catalog_id leads the email with the value delta.
  describe("catalog_id valuation delta", () => {
    const delta = {
      current: {
        low: 880_000,
        mid: 1_100_000,
        high: 1_320_000,
        measured_at: "2026-07-29T00:00:00Z",
      },
      previous: {
        low: 800_000,
        mid: 1_000_000,
        high: 1_200_000,
        measured_at: "2026-07-22T00:00:00Z",
      },
    };

    it("prefixes the subject and prepends the hero when a delta resolves", async () => {
      mockSendEmailWithResend.mockResolvedValue({ id: "email-d1" });
      mockGetCatalogValuationDelta.mockResolvedValue(delta);

      await processAndSendEmail({
        to: ["user@example.com"],
        subject: "Weekly report",
        text: "Body",
        catalog_id: "740d5050-40ec-4892-a040-b78bb50fef2f",
      });

      expect(mockGetCatalogValuationDelta).toHaveBeenCalledWith({
        catalogId: "740d5050-40ec-4892-a040-b78bb50fef2f",
      });
      expect(mockSendEmailWithResend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "$1.1M (+10.0%) · Weekly report",
          html: expect.stringContaining("since your last measurement"),
        }),
      );
    });

    it("sends the email unchanged when no delta resolves (unowned/empty catalog)", async () => {
      mockSendEmailWithResend.mockResolvedValue({ id: "email-d2" });
      mockGetCatalogValuationDelta.mockResolvedValue(null);

      await processAndSendEmail({
        to: ["user@example.com"],
        subject: "Weekly report",
        text: "Body",
        catalog_id: "740d5050-40ec-4892-a040-b78bb50fef2f",
      });

      expect(mockSendEmailWithResend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Weekly report" }),
      );
    });

    it("still sends when the delta lookup throws (best-effort)", async () => {
      mockSendEmailWithResend.mockResolvedValue({ id: "email-d3" });
      mockGetCatalogValuationDelta.mockRejectedValue(new Error("down"));

      const result = await processAndSendEmail({
        to: ["user@example.com"],
        subject: "Weekly report",
        text: "Body",
        catalog_id: "740d5050-40ec-4892-a040-b78bb50fef2f",
      });

      expect(result.success).toBe(true);
      expect(mockSendEmailWithResend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Weekly report" }),
      );
    });

    it("never touches the delta path without a catalog_id", async () => {
      mockSendEmailWithResend.mockResolvedValue({ id: "email-d4" });

      await processAndSendEmail({ to: ["user@example.com"], subject: "T", text: "B" });

      expect(mockGetCatalogValuationDelta).not.toHaveBeenCalled();
    });
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
});
