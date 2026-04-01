import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCopyChatMessagesBody } from "@/lib/chats/validateCopyChatMessagesBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const sourceChatId = "123e4567-e89b-42d3-a456-426614174000";
const targetChatId = "123e4567-e89b-42d3-a456-426614174001";

const createRequest = (body: unknown) =>
  new NextRequest(`http://localhost/api/chats/${sourceChatId}/messages/copy`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
  });

describe("validateCopyChatMessagesBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid body", async () => {
    const result = await validateCopyChatMessagesBody(createRequest({}), sourceChatId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when source and target ids are same", async () => {
    const result = await validateCopyChatMessagesBody(
      createRequest({ targetChatId: sourceChatId }),
      sourceChatId,
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns validated payload and defaults clearExisting to true", async () => {
    const result = await validateCopyChatMessagesBody(
      createRequest({ targetChatId }),
      sourceChatId,
    );

    expect(result).toEqual({
      targetChatId,
      clearExisting: true,
    });
  });
});
