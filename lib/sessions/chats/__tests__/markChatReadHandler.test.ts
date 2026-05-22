import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/chats/validateMarkChatReadRequest", () => ({
  validateMarkChatReadRequest: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_reads/upsertChatRead", () => ({
  upsertChatRead: vi.fn(),
}));

const { validateMarkChatReadRequest } = await import(
  "@/lib/sessions/chats/validateMarkChatReadRequest"
);
const { upsertChatRead } = await import("@/lib/supabase/chat_reads/upsertChatRead");
const { markChatReadHandler } = await import("@/lib/sessions/chats/markChatReadHandler");

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest(
    "https://example.com/api/sessions/sess_1/chats/chat_1/read",
    { method: "POST" },
  );
}

function mockValidated() {
  vi.mocked(validateMarkChatReadRequest).mockResolvedValue({
    auth: { accountId, orgId: null, authToken: "tok" },
    session: baseSessionRow({ id: "sess_1", account_id: accountId }),
    chat: baseChatRow({ id: "chat_1", session_id: "sess_1" }),
  });
}

describe("markChatReadHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the NextResponse from validateMarkChatReadRequest as-is", async () => {
    const failure = NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    vi.mocked(validateMarkChatReadRequest).mockResolvedValue(failure);

    const res = await markChatReadHandler(makeReq(), "sess_1", "chat_1");
    expect(res).toBe(failure);
    expect(upsertChatRead).not.toHaveBeenCalled();
  });

  it("returns { status: ok } when upsert succeeds", async () => {
    mockValidated();
    vi.mocked(upsertChatRead).mockResolvedValue({
      account_id: accountId,
      chat_id: "chat_1",
      last_read_at: "2026-05-21T00:00:00.000Z",
      created_at: "2026-05-21T00:00:00.000Z",
      updated_at: "2026-05-21T00:00:00.000Z",
    });

    const res = await markChatReadHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(upsertChatRead).toHaveBeenCalledWith(accountId, "chat_1");
  });

  it("returns 500 when upsertChatRead fails", async () => {
    mockValidated();
    vi.mocked(upsertChatRead).mockResolvedValue(null);

    const res = await markChatReadHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Failed to mark chat as read",
    });
  });
});
