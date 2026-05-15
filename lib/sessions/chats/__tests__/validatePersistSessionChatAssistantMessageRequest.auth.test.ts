import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { validatePersistSessionChatAssistantMessageRequest } = await import(
  "@/lib/sessions/chats/validatePersistSessionChatAssistantMessageRequest"
);

const accountId = "acc-uuid-1";
const msg = { message: { id: "m", role: "assistant" as const, parts: [] } };

describe("validatePersistSessionChatAssistantMessageRequest — auth & session row", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "nope" }, { status: 401 }),
    );
    const req = new NextRequest("http://x/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
    const res = await validatePersistSessionChatAssistantMessageRequest(req, "sess_1", "c");
    expect((res as NextResponse).status).toBe(401);
  });

  it("returns 404 when session does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);
    const req = new NextRequest("http://x/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
    const res = await validatePersistSessionChatAssistantMessageRequest(req, "sess_x", "c");
    expect((res as NextResponse).status).toBe(404);
    expect(await (res as NextResponse).json()).toEqual({
      status: "error",
      error: "Session not found",
    });
  });

  it("returns 403 when another account owns the session", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: "acc-OTHER" }),
    ]);
    const req = new NextRequest("http://x/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
    const res = await validatePersistSessionChatAssistantMessageRequest(req, "sess_1", "c");
    expect((res as NextResponse).status).toBe(403);
  });
});
