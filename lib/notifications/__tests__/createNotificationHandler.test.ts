import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createNotificationHandler } from "../createNotificationHandler";

const mockValidateAuthContext = vi.fn();
const mockSendEmailWithResend = vi.fn();
const mockSelectRoomWithArtist = vi.fn();
const mockSelectAccountEmails = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: (...args: unknown[]) => mockSendEmailWithResend(...args),
}));

vi.mock("@/lib/supabase/rooms/selectRoomWithArtist", () => ({
  selectRoomWithArtist: (...args: unknown[]) => mockSelectRoomWithArtist(...args),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: (...args: unknown[]) => mockSelectAccountEmails(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(async (req: Request) => req.json()),
}));

function createRequest(body: unknown): NextRequest {
  return new NextRequest("https://recoup-api.vercel.app/api/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "test-key",
    },
    body: JSON.stringify(body),
  });
}

describe("createNotificationHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "test-key",
    });
    mockSelectAccountEmails.mockResolvedValue([
      { id: "email-1", account_id: "account-123", email: "owner@example.com", updated_at: "" },
    ]);
  });

  it("returns 401 when authentication fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = createRequest({ subject: "Test" });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when body validation fails", async () => {
    const request = createRequest({});
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.status).toBe("error");
  });

  it("returns 400 when account has no email", async () => {
    mockSelectAccountEmails.mockResolvedValue([]);

    const request = createRequest({ subject: "Test", text: "Hello" });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("No email address found");
  });

  it("sends email to account owner with text body", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-123" });

    const request = createRequest({
      subject: "Test Subject",
      text: "Hello world",
    });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.id).toBe("email-123");
    expect(data.message).toContain("owner@example.com");
    expect(mockSelectAccountEmails).toHaveBeenCalledWith({ accountIds: "account-123" });
    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Agent by Recoup <agent@recoupable.com>",
        to: ["owner@example.com"],
        subject: "Test Subject",
        html: expect.stringContaining("Hello world"),
      }),
    );
  });

  it("sends email with html body taking precedence over text", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-456" });

    const request = createRequest({
      subject: "Test",
      text: "plain text",
      html: "<h1>HTML body</h1>",
    });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(200);
    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("<h1>HTML body</h1>"),
      }),
    );
  });

  it("includes CC addresses when provided", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-789" });

    const request = createRequest({
      cc: ["cc@example.com"],
      subject: "Test",
      text: "Hello",
    });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(200);
    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: ["cc@example.com"],
      }),
    );
  });

  it("includes room footer when room_id is provided", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-room" });
    mockSelectRoomWithArtist.mockResolvedValue({ artist_name: "Test Artist" });

    const request = createRequest({
      subject: "Test",
      text: "Hello",
      room_id: "room-abc",
    });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(200);
    expect(mockSelectRoomWithArtist).toHaveBeenCalledWith("room-abc");
    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Test Artist"),
      }),
    );
  });

  it("returns 502 when email delivery fails", async () => {
    const errorResponse = NextResponse.json(
      { error: { message: "Rate limited" } },
      { status: 429 },
    );
    mockSendEmailWithResend.mockResolvedValue(errorResponse);

    const request = createRequest({
      subject: "Test",
      text: "Hello",
    });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.status).toBe("error");
    expect(data.error).toContain("Rate limited");
  });
});
