import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/chats/validateDeleteSessionChatRequest", () => ({
  validateDeleteSessionChatRequest: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/deleteChat", () => ({
  deleteChat: vi.fn(),
}));

const { validateDeleteSessionChatRequest } = await import(
  "@/lib/sessions/chats/validateDeleteSessionChatRequest"
);
const { deleteChat } = await import("@/lib/supabase/chats/deleteChat");
const { deleteSessionChatHandler } = await import("@/lib/sessions/chats/deleteSessionChatHandler");

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1", {
    method: "DELETE",
  });
}

describe("deleteSessionChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the NextResponse from the validator as-is", async () => {
    const failure = NextResponse.json(
      { error: "Cannot delete the only chat in a session" },
      { status: 400 },
    );
    vi.mocked(validateDeleteSessionChatRequest).mockResolvedValue(failure);

    const res = await deleteSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res).toBe(failure);
    expect(deleteChat).not.toHaveBeenCalled();
  });

  it("returns { success: true } on the happy path", async () => {
    vi.mocked(validateDeleteSessionChatRequest).mockResolvedValue(null);
    vi.mocked(deleteChat).mockResolvedValue(true);

    const res = await deleteSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(200);
    expect(deleteChat).toHaveBeenCalledWith("chat_1");
    expect(await res.json()).toEqual({ success: true });
  });

  it("returns 500 when deleteChat reports failure", async () => {
    vi.mocked(validateDeleteSessionChatRequest).mockResolvedValue(null);
    vi.mocked(deleteChat).mockResolvedValue(false);

    const res = await deleteSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(500);
  });
});
