import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { validateCreateSessionChatRequest } from "@/lib/sessions/chats/validateCreateSessionChatRequest";
import { validateGetSessionChatsRequest } from "@/lib/sessions/chats/validateGetSessionChatsRequest";
import { validateGetSessionChatRequest } from "@/lib/sessions/chats/validateGetSessionChatRequest";
import { validateDeleteSessionChatRequest } from "@/lib/sessions/chats/validateDeleteSessionChatRequest";
import { validatePatchSessionChatRequest } from "@/lib/sessions/chats/validatePatchSessionChatRequest";
import { validateMarkChatReadRequest } from "@/lib/sessions/chats/validateMarkChatReadRequest";
import { createSessionChatHandler } from "@/lib/sessions/chats/createSessionChatHandler";
import { getSessionChatsHandler } from "@/lib/sessions/chats/getSessionChatsHandler";
import { getChatSummaries } from "@/lib/sessions/chats/getChatSummaries";
import { validateChatOwnership } from "@/lib/chat/validateChatOwnership";
import { hasActiveStreamForSession } from "@/lib/sandbox/hasActiveStreamForSession";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/supabase/chats/insertChat", () => ({ insertChat: vi.fn() }));
vi.mock("@/lib/supabase/chat_reads/selectChatReads", () => ({ selectChatReads: vi.fn() }));
vi.mock("@/lib/sessions/chats/validateCreateSessionChatRequest", () => ({
  validateCreateSessionChatRequest: vi.fn(),
}));
vi.mock("@/lib/sessions/chats/validateGetSessionChatsRequest", () => ({
  validateGetSessionChatsRequest: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
const chatId = "11111111-2222-4333-8444-555555555555";
const auth = { accountId: "synthetic-account", orgId: null, authToken: "synthetic-token" };
const session = { id: "synthetic-session", account_id: auth.accountId };
const request = () =>
  new NextRequest("https://synthetic.invalid/api/sessions/synthetic-session/chats", {
    method: "PATCH",
    body: JSON.stringify({ title: "Synthetic" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue(auth);
  vi.mocked(selectSessions).mockResolvedValue([session] as never);
  vi.mocked(selectChats).mockResolvedValue(null);
  vi.mocked(validateCreateSessionChatRequest).mockResolvedValue({
    auth,
    session,
    body: { id: chatId },
  } as never);
  vi.mocked(validateGetSessionChatsRequest).mockResolvedValue({ auth, session } as never);
});
describe("failed chat reads must not become missing chats or permission to write", () => {
  it.each([
    ["GET", validateGetSessionChatRequest],
    ["DELETE", validateDeleteSessionChatRequest],
    ["PATCH", validatePatchSessionChatRequest],
    ["mark read", validateMarkChatReadRequest],
  ] as const)(
    "returns 500 for %s without treating an unavailable row as missing",
    async (_name, validate) => {
      const response = await validate(request(), session.id, chatId);
      expect(response).toBeInstanceOf(NextResponse);
      expect((response as NextResponse).status).toBe(500);
    },
  );
  it("returns 500 for a failed ownership lookup", async () => {
    const response = await validateChatOwnership(request(), chatId);
    expect(response).toBeInstanceOf(NextResponse);
    expect((response as NextResponse).status).toBe(500);
  });
  it("does not insert a chat after a failed idempotency lookup", async () => {
    const response = await createSessionChatHandler(request(), session.id);
    expect(response.status).toBe(500);
    expect(insertChat).not.toHaveBeenCalled();
  });
  it("does not render an empty successful chat list on read failure", async () => {
    const response = await getSessionChatsHandler(request(), session.id);
    expect(response.status).toBe(500);
  });
  it("distinguishes summary failure from an empty successful list", async () => {
    expect(await getChatSummaries({ sessionId: session.id, accountId: auth.accountId })).toBeNull();
    vi.mocked(selectChats).mockResolvedValue([]);
    expect(await getChatSummaries({ sessionId: session.id, accountId: auth.accountId })).toEqual(
      [],
    );
  });
  it("defers sandbox hibernation when active-stream lookup is unavailable", async () => {
    expect(await hasActiveStreamForSession(session.id)).toBe(true);
  });
});
