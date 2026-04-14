import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateNewEmailMemory } from "../validateNewEmailMemory";
import type { ResendEmailReceivedEvent } from "@/lib/emails/validateInboundEmailEvent";
import { NextResponse } from "next/server";

import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { getEmailContent } from "@/lib/emails/inbound/getEmailContent";
import { getEmailRoomId } from "@/lib/emails/inbound/getEmailRoomId";
import { setupConversation } from "@/lib/chat/setupConversation";
import { getEmailAttachments } from "@/lib/emails/inbound/getEmailAttachments";
import { formatAttachmentsText } from "@/lib/emails/inbound/formatAttachmentsText";

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/emails/inbound/getEmailContent", () => ({
  getEmailContent: vi.fn(),
}));

vi.mock("@/lib/emails/inbound/getEmailRoomId", () => ({
  getEmailRoomId: vi.fn(),
}));

vi.mock("@/lib/emails/inbound/trimRepliedContext", () => ({
  trimRepliedContext: vi.fn((html: string) => html),
}));

vi.mock("@/lib/chat/setupConversation", () => ({
  setupConversation: vi.fn(),
}));

vi.mock("@/lib/supabase/memory_emails/insertMemoryEmail", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/messages/getMessages", () => ({
  getMessages: vi.fn((text: string) => [{ role: "user", content: text }]),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_API_KEY: "test-recoup-api-key",
}));

vi.mock("@/lib/emails/inbound/getEmailAttachments", () => ({
  getEmailAttachments: vi.fn(),
}));

vi.mock("@/lib/emails/inbound/formatAttachmentsText", () => ({
  formatAttachmentsText: vi.fn(),
}));

const MOCK_ACCOUNT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MOCK_ROOM_ID = "11111111-2222-3333-4444-555555555555";
const MOCK_EMAIL_ID = "email-123";
const MOCK_MESSAGE_ID = "msg-456";

/**
 * Create Mock Event.
 *
 * @param overrides - Optional override values.
 * @returns - Computed result.
 */
function createMockEvent(
  overrides?: Partial<ResendEmailReceivedEvent["data"]>,
): ResendEmailReceivedEvent {
  return {
    type: "email.received",
    created_at: "2024-01-01T00:00:00.000Z",
    data: {
      email_id: MOCK_EMAIL_ID,
      from: "artist@example.com",
      to: ["agent@mail.recoupable.com"],
      subject: "Test email",
      message_id: MOCK_MESSAGE_ID,
      created_at: "2024-01-01T00:00:00.000Z",
      ...overrides,
    },
  } as ResendEmailReceivedEvent;
}

describe("validateNewEmailMemory", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(selectAccountEmails).mockResolvedValue([
      { account_id: MOCK_ACCOUNT_ID } as Awaited<ReturnType<typeof selectAccountEmails>>[0],
    ]);

    vi.mocked(getEmailContent).mockResolvedValue({
      html: "<p>Hello from email</p>",
      headers: {},
    } as Awaited<ReturnType<typeof getEmailContent>>);

    vi.mocked(getEmailRoomId).mockResolvedValue(undefined);

    vi.mocked(setupConversation).mockResolvedValue({ roomId: MOCK_ROOM_ID });

    vi.mocked(getEmailAttachments).mockResolvedValue([]);

    vi.mocked(formatAttachmentsText).mockReturnValue("");
  });

  it("includes authToken from RECOUP_API_KEY in chatRequestBody", async () => {
    const event = createMockEvent();

    const result = await validateNewEmailMemory(event);

    // Should not be a response (duplicate)
    expect(result).not.toHaveProperty("response");

    const { chatRequestBody } = result as {
      chatRequestBody: { authToken?: string };
      emailText: string;
    };
    expect(chatRequestBody.authToken).toBe("test-recoup-api-key");
  });

  it("returns chatRequestBody with correct accountId, orgId, messages, and roomId", async () => {
    const event = createMockEvent();

    const result = await validateNewEmailMemory(event);
    const { chatRequestBody } = result as {
      chatRequestBody: Record<string, unknown>;
      emailText: string;
    };

    expect(chatRequestBody.accountId).toBe(MOCK_ACCOUNT_ID);
    expect(chatRequestBody.orgId).toBeNull();
    expect(chatRequestBody.roomId).toBe(MOCK_ROOM_ID);
    expect(chatRequestBody.messages).toBeDefined();
  });

  it("returns duplicate response when setupConversation throws unique constraint error", async () => {
    vi.mocked(setupConversation).mockRejectedValue({ code: "23505" });

    const event = createMockEvent();
    const result = await validateNewEmailMemory(event);

    expect(result).toHaveProperty("response");
    const { response } = result as { response: NextResponse };
    expect(response.status).toBe(200);
  });

  it("fetches attachments and appends download URLs to emailText", async () => {
    const attachmentText =
      "\n\nAttached files:\n- logo.svg (image/svg+xml): https://resend.com/dl/att-1";
    vi.mocked(getEmailAttachments).mockResolvedValue([
      {
        id: "att-1",
        filename: "logo.svg",
        size: 1024,
        content_type: "image/svg+xml",
        content_disposition: "attachment",
        download_url: "https://resend.com/dl/att-1",
        expires_at: "2025-01-01T01:00:00Z",
      },
    ] as Awaited<ReturnType<typeof getEmailAttachments>>);
    vi.mocked(formatAttachmentsText).mockReturnValue(attachmentText);

    const event = createMockEvent();
    const result = await validateNewEmailMemory(event);

    expect(result).not.toHaveProperty("response");
    expect(getEmailAttachments).toHaveBeenCalledWith(MOCK_EMAIL_ID);

    const { emailText } = result as { chatRequestBody: Record<string, unknown>; emailText: string };
    expect(emailText).toContain("Attached files:");
    expect(emailText).toContain("https://resend.com/dl/att-1");
  });

  it("does not append text when no attachments exist", async () => {
    vi.mocked(getEmailAttachments).mockResolvedValue([]);
    vi.mocked(formatAttachmentsText).mockReturnValue("");

    const event = createMockEvent();
    const result = await validateNewEmailMemory(event);

    const { emailText } = result as { chatRequestBody: Record<string, unknown>; emailText: string };
    expect(emailText).toBe("<p>Hello from email</p>");
  });
});
