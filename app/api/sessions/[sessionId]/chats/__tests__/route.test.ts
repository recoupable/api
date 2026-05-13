import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, OPTIONS } from "../route";
import type { Tables } from "@/types/database.types";

type SessionRow = Tables<"sessions">;
type ChatRow = Tables<"chats">;

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
const { selectChatReadsByAccountAndChatIds } = await import(
  "@/lib/supabase/chat_reads/selectChatReadsByAccountAndChatIds"
);
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");

function makeReq(url = "https://example.com/api/sessions/sess_1/chats"): NextRequest {
  return new NextRequest(url);
}

const mockSession: SessionRow = {
  id: "sess_1",
  account_id: "acc-uuid-1",
  title: "Test session",
  status: "running",
  repo_owner: "acme",
  repo_name: "demo",
  branch: "main",
  clone_url: "https://github.com/acme/demo.git",
  is_new_branch: false,
  global_skill_refs: [],
  sandbox_state: { type: "vercel" },
  lifecycle_state: "active",
  lifecycle_version: 1,
  last_activity_at: "2026-05-04T00:00:00.000Z",
  sandbox_expires_at: null,
  hibernate_after: null,
  lifecycle_run_id: null,
  lifecycle_error: null,
  lines_added: 12,
  lines_removed: 3,
  snapshot_url: null,
  snapshot_created_at: null,
  snapshot_size_bytes: null,
  cached_diff: null,
  cached_diff_updated_at: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-04T00:00:00.000Z",
};

const baseChat = (overrides: Partial<ChatRow> = {}): ChatRow => ({
  id: "chat_1",
  session_id: "sess_1",
  title: "New chat",
  model_id: "openai/gpt-5",
  active_stream_id: null,
  last_assistant_message_at: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
  ...overrides,
});

describe("OPTIONS /api/sessions/[sessionId]/chats", () => {
  it("returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sessions/[sessionId]/chats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(makeReq(), {
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

    const res = await GET(makeReq(), {
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

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Forbidden",
    });
    expect(selectChats).not.toHaveBeenCalled();
  });

  it("returns 200 with ChatSummary list and defaultModelId", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-1",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([mockSession]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChat({
        id: "c1",
        last_assistant_message_at: "2026-05-02T00:00:00.000Z",
        created_at: "2026-05-01T10:00:00.000Z",
      }),
    ]);
    vi.mocked(selectChatReadsByAccountAndChatIds).mockResolvedValue([
      {
        account_id: "acc-uuid-1",
        chat_id: "c1",
        created_at: "2026-05-01T00:00:00.000Z",
        last_read_at: "2026-05-03T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z",
      },
    ]);

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    expect(res.status).toBe(200);
    expect(selectChats).toHaveBeenCalledWith({
      sessionId: "sess_1",
      orderCreatedAtAscending: true,
    });
    expect(selectChatReadsByAccountAndChatIds).toHaveBeenCalledWith("acc-uuid-1", ["c1"]);

    const body = await res.json();
    expect(body.defaultModelId).toBe("openai/gpt-5-mini");
    expect(body.chats).toEqual([
      {
        id: "c1",
        sessionId: "sess_1",
        title: "New chat",
        modelId: "openai/gpt-5",
        activeStreamId: null,
        lastAssistantMessageAt: "2026-05-02T00:00:00.000Z",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        hasUnread: false,
        isStreaming: false,
      },
    ]);
  });

  it("hasUnread true when assistant message is newer than last read", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-1",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([mockSession]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChat({
        id: "c1",
        last_assistant_message_at: "2026-05-04T00:00:00.000Z",
      }),
    ]);
    vi.mocked(selectChatReadsByAccountAndChatIds).mockResolvedValue([
      {
        account_id: "acc-uuid-1",
        chat_id: "c1",
        created_at: "2026-05-01T00:00:00.000Z",
        last_read_at: "2026-05-03T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z",
      },
    ]);

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    const body = await res.json();
    expect(body.chats[0].hasUnread).toBe(true);
  });

  it("isStreaming true when activeStreamId is set", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-1",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([mockSession]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChat({ id: "c1", active_stream_id: "stream_xyz" }),
    ]);
    vi.mocked(selectChatReadsByAccountAndChatIds).mockResolvedValue([]);

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    const body = await res.json();
    expect(body.chats[0].isStreaming).toBe(true);
  });

  it("coalesces null model_id to defaultModel string", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-1",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([mockSession]);
    vi.mocked(selectChats).mockResolvedValue([baseChat({ id: "c1", model_id: null })]);
    vi.mocked(selectChatReadsByAccountAndChatIds).mockResolvedValue([]);

    const res = await GET(makeReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    const body = await res.json();
    expect(body.chats[0].modelId).toBe("openai/gpt-5-mini");
  });
});
