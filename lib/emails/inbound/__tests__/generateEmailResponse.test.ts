import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEmailResponse } from "../generateEmailResponse";
import type { ChatRequestBody } from "@/lib/chat/validateChatRequest";

import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { getEmailRoomMessages } from "@/lib/emails/inbound/getEmailRoomMessages";

vi.mock("@/lib/agents/generalAgent/getGeneralAgent", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/emails/inbound/getEmailRoomMessages", () => ({
  getEmailRoomMessages: vi.fn(),
}));

vi.mock("@/lib/emails/getEmailFooter", () => ({
  getEmailFooter: vi.fn(() => "<footer>footer</footer>"),
}));

vi.mock("@/lib/supabase/rooms/selectRoomWithArtist", () => ({
  selectRoomWithArtist: vi.fn(() => ({ artist_name: "Test Artist" })),
}));

const mockGenerate = vi.fn();

describe("generateEmailResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getGeneralAgent).mockResolvedValue({
      agent: { generate: mockGenerate },
    } as unknown as Awaited<ReturnType<typeof getGeneralAgent>>);

    mockGenerate.mockResolvedValue({ text: "Hello from assistant" });
  });

  it("throws when roomId is missing", async () => {
    const body = { accountId: "acc-1", orgId: null, messages: [] } as ChatRequestBody;

    await expect(generateEmailResponse(body)).rejects.toThrow(
      "roomId is required to generate email response HTML",
    );
  });

  it("generates response without attachments", async () => {
    vi.mocked(getEmailRoomMessages).mockResolvedValue([{ role: "user", content: "Hi there" }]);

    const body: ChatRequestBody = {
      accountId: "acc-1",
      orgId: null,
      messages: [],
      roomId: "room-1",
    };

    const result = await generateEmailResponse(body);

    expect(mockGenerate).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "Hi there" }],
    });
    expect(result.text).toBe("Hello from assistant");
    expect(result.html).toContain("Hello from assistant");
    expect(result.html).toContain("<footer>footer</footer>");
  });

  it("appends image parts to last user message when image attachments exist", async () => {
    vi.mocked(getEmailRoomMessages).mockResolvedValue([
      { role: "user", content: "Check this image" },
    ]);

    const body: ChatRequestBody = {
      accountId: "acc-1",
      orgId: null,
      messages: [],
      roomId: "room-1",
      attachments: [
        {
          id: "att-1",
          filename: "logo.png",
          contentType: "image/png",
          downloadUrl: "https://resend.com/dl/att-1",
        },
      ],
    };

    await generateEmailResponse(body);

    const callArgs = mockGenerate.mock.calls[0][0];
    const lastUserMsg = callArgs.messages[0];

    // Should have been converted to parts array with text + image
    expect(Array.isArray(lastUserMsg.content)).toBe(true);
    expect(lastUserMsg.content[0]).toEqual({ type: "text", text: "Check this image" });
    expect(lastUserMsg.content[1]).toMatchObject({
      type: "image",
      mimeType: "image/png",
    });
    expect(lastUserMsg.content[1].image).toBeInstanceOf(URL);
    expect(lastUserMsg.content[1].image.href).toBe("https://resend.com/dl/att-1");
  });

  it("does not modify messages when only non-image attachments exist", async () => {
    vi.mocked(getEmailRoomMessages).mockResolvedValue([
      { role: "user", content: "Check this file" },
    ]);

    const body: ChatRequestBody = {
      accountId: "acc-1",
      orgId: null,
      messages: [],
      roomId: "room-1",
      attachments: [
        {
          id: "att-1",
          filename: "report.pdf",
          contentType: "application/pdf",
          downloadUrl: "https://resend.com/dl/att-1",
        },
      ],
    };

    await generateEmailResponse(body);

    const callArgs = mockGenerate.mock.calls[0][0];
    const lastUserMsg = callArgs.messages[0];

    // Should remain as plain string (no image parts to add)
    expect(lastUserMsg.content).toBe("Check this file");
  });

  it("appends image parts to the last user message in multi-message conversations", async () => {
    vi.mocked(getEmailRoomMessages).mockResolvedValue([
      { role: "user", content: "First message" },
      { role: "assistant", content: "Reply" },
      { role: "user", content: "Here is the image" },
    ]);

    const body: ChatRequestBody = {
      accountId: "acc-1",
      orgId: null,
      messages: [],
      roomId: "room-1",
      attachments: [
        {
          id: "att-1",
          filename: "photo.jpg",
          contentType: "image/jpeg",
          downloadUrl: "https://resend.com/dl/att-1",
        },
      ],
    };

    await generateEmailResponse(body);

    const callArgs = mockGenerate.mock.calls[0][0];
    // First user message should be unchanged
    expect(callArgs.messages[0].content).toBe("First message");
    // Last user message should have image parts
    expect(Array.isArray(callArgs.messages[2].content)).toBe(true);
    expect(callArgs.messages[2].content[0]).toEqual({
      type: "text",
      text: "Here is the image",
    });
    expect(callArgs.messages[2].content[1].type).toBe("image");
  });
});
