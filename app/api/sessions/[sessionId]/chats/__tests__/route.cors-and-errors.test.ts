import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { GET, OPTIONS } from "../route";
import { makeChatsListReq, mockSession } from "./chatsRouteTestFixtures";

vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));

vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

vi.mock("@/lib/supabase/chat_reads/selectChatReadsByAccountAndChatIds", () => ({
  selectChatReadsByAccountAndChatIds: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");

describe("OPTIONS /api/sessions/[sessionId]/chats", () => {
  it("returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sessions/[sessionId]/chats — auth and session errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(makeChatsListReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    expect(res.status).toBe(401);
    expect(selectSessions).not.toHaveBeenCalled();
  });

  it("returns 404 when session does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-1",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await GET(makeChatsListReq(), {
      params: Promise.resolve({ sessionId: "sess_missing" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Session not found",
    });
    expect(selectChats).not.toHaveBeenCalled();
  });

  it("returns 403 when session is owned by a different account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-OTHER",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([mockSession]);

    const res = await GET(makeChatsListReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Forbidden",
    });
    expect(selectChats).not.toHaveBeenCalled();
  });
});
