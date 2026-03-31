import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createNotificationHandler } from "../createNotificationHandler";

const mockValidateAuthContext = vi.fn();
const mockSelectAccountEmails = vi.fn();
const mockProcessAndSendEmail = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: (...args: unknown[]) => mockSelectAccountEmails(...args),
}));

vi.mock("@/lib/emails/processAndSendEmail", () => ({
  processAndSendEmail: (...args: unknown[]) => mockProcessAndSendEmail(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(async (req: Request) => req.json()),
}));

/**
 * Creates a mock POST request to the notifications endpoint with JSON body and auth header.
 *
 * @param body - The request body to serialize as JSON
 * @returns A NextRequest instance for use in tests
 */
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
    mockProcessAndSendEmail.mockResolvedValue({
      success: true,
      message:
        "Email sent successfully from Agent by Recoup <agent@recoupable.com> to owner@example.com. CC: none.",
      id: "email-123",
    });

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
    expect(mockProcessAndSendEmail).toHaveBeenCalledWith({
      to: ["owner@example.com"],
      cc: [],
      subject: "Test Subject",
      text: "Hello world",
      html: "",
      headers: {},
      room_id: undefined,
    });
  });

  it("passes CC and room_id through to processAndSendEmail", async () => {
    mockProcessAndSendEmail.mockResolvedValue({
      success: true,
      message: "Email sent successfully.",
      id: "email-789",
    });

    const request = createRequest({
      cc: ["cc@example.com"],
      subject: "Test",
      text: "Hello",
      room_id: "room-abc",
    });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(200);
    expect(mockProcessAndSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: ["cc@example.com"],
        room_id: "room-abc",
      }),
    );
  });

  it("returns 502 when email delivery fails", async () => {
    mockProcessAndSendEmail.mockResolvedValue({
      success: false,
      error: "Rate limited",
    });

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

  it("resolves email from account_id override", async () => {
    const overrideAccountId = "550e8400-e29b-41d4-a716-446655440000";

    mockValidateAuthContext.mockResolvedValue({
      accountId: overrideAccountId,
      orgId: "org-id",
      authToken: "test-key",
    });
    mockSelectAccountEmails.mockResolvedValue([
      { id: "email-2", account_id: overrideAccountId, email: "member@example.com", updated_at: "" },
    ]);
    mockProcessAndSendEmail.mockResolvedValue({
      success: true,
      message: "Email sent successfully to member@example.com.",
      id: "email-override",
    });

    const request = createRequest({
      subject: "Override Test",
      text: "Hello member",
      account_id: overrideAccountId,
    });
    const response = await createNotificationHandler(request);

    expect(response.status).toBe(200);
    expect(mockValidateAuthContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: overrideAccountId }),
    );
    expect(mockSelectAccountEmails).toHaveBeenCalledWith({ accountIds: overrideAccountId });
    expect(mockProcessAndSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["member@example.com"],
        subject: "Override Test",
      }),
    );
  });
});
