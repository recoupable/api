import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateWorkflowChatAccess } from "@/lib/chats/validateWorkflowChatAccess";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));

const chatId = "123e4567-e89b-42d3-a456-426614174000";
const sessionId = "123e4567-e89b-42d3-a456-426614174010";
const accountId = "11111111-1111-1111-1111-111111111111";
const request = new NextRequest(`http://localhost/api/chats/${chatId}/messages/trailing`);

describe("validateWorkflowChatAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid chat id", async () => {
    const result = await validateWorkflowChatAccess(request, "not-a-uuid");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("passes through auth errors", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateWorkflowChatAccess(request, chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 404 when chat does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId });
    vi.mocked(selectChats).mockResolvedValue([]);

    const result = await validateWorkflowChatAccess(request, chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns 403 when session belongs to another account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId });
    vi.mocked(selectChats).mockResolvedValue([
      {
        id: chatId,
        session_id: sessionId,
        title: "Chat",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        active_stream_id: null,
        last_assistant_message_at: null,
        model_id: null,
      },
    ]);
    vi.mocked(selectSessions).mockResolvedValue([
      {
        id: sessionId,
        account_id: "22222222-2222-2222-2222-222222222222",
      } as never,
    ]);

    const result = await validateWorkflowChatAccess(request, chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns validated access when chat and session belong to caller", async () => {
    const chat = {
      id: chatId,
      session_id: sessionId,
      title: "Chat",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      active_stream_id: null,
      last_assistant_message_at: null,
      model_id: null,
    };

    vi.mocked(validateAuthContext).mockResolvedValue({ accountId });
    vi.mocked(selectChats).mockResolvedValue([chat]);
    vi.mocked(selectSessions).mockResolvedValue([
      {
        id: sessionId,
        account_id: accountId,
      } as never,
    ]);

    const result = await validateWorkflowChatAccess(request, chatId);
    expect(result).toEqual({ chatId, chat, accountId });
  });
});
