import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

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

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1", {
    method: "DELETE",
  });
}

function mockValidated() {
  vi.mocked(validateDeleteSessionChatRequest).mockResolvedValue({
    auth: { accountId, orgId: null, authToken: "tok" },
    session: baseSessionRow({ id: "sess_1", account_id: accountId }),
    chat: baseChatRow({ id: "chat_1", session_id: "sess_1" }),
    siblingChats: [
      baseChatRow({ id: "chat_1", session_id: "sess_1" }),
      baseChatRow({ id: "chat_2", session_id: "sess_1" }),
    ],
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
    mockValidated();
    vi.mocked(deleteChat).mockResolvedValue(true);

    const res = await deleteSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(200);
    expect(deleteChat).toHaveBeenCalledWith("chat_1");
    expect(await res.json()).toEqual({ success: true });
  });

  it("returns 500 when deleteChat reports failure", async () => {
    mockValidated();
    vi.mocked(deleteChat).mockResolvedValue(false);

    const res = await deleteSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(500);
  });
});
