import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateChatOwnership } from "@/lib/chat/validateChatOwnership";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));

const CHAT_ID = "11111111-2222-4333-8444-555555555555";
const OWNER = "owner-account";
const ADMIN_TARGET = "22222222-3333-4444-8555-666666666666";

const req = (qs = "") =>
  new NextRequest(`https://api.test/api/chat/${CHAT_ID}/stream${qs}`, { method: "GET" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: OWNER, orgId: null } as never);
  vi.mocked(selectChats).mockResolvedValue([{ id: CHAT_ID, session_id: "sess-1" }] as never);
  vi.mocked(selectSessions).mockResolvedValue([{ id: "sess-1", account_id: OWNER }] as never);
});

describe("validateChatOwnership", () => {
  it("resolves for the owning account", async () => {
    const result = await validateChatOwnership(req(), CHAT_ID);
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  // Without this an org/admin key cannot reach a member's chat — the same gap
  // DELETE /api/tasks has (chat#1918). validateAuthContext is what decides
  // whether the caller may actually use the override.
  it("forwards an account_id query override to validateAuthContext", async () => {
    await validateChatOwnership(req(`?account_id=${ADMIN_TARGET}`), CHAT_ID);

    expect(validateAuthContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: ADMIN_TARGET }),
    );
  });

  it("lets an approved override through to a chat the key does not personally own", async () => {
    // validateAuthContext approved the override, so the effective account is
    // the target — which owns the session.
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ADMIN_TARGET,
      orgId: "org-1",
    } as never);
    vi.mocked(selectSessions).mockResolvedValue([
      { id: "sess-1", account_id: ADMIN_TARGET },
    ] as never);

    const result = await validateChatOwnership(req(`?account_id=${ADMIN_TARGET}`), CHAT_ID);

    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("still 403s when the resolved account does not own the session", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { id: "sess-1", account_id: "someone-else" },
    ] as never);

    const result = await validateChatOwnership(req(), CHAT_ID);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("omits the override key entirely when no account_id is supplied", async () => {
    await validateChatOwnership(req(), CHAT_ID);

    expect(validateAuthContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: undefined }),
    );
  });
});
