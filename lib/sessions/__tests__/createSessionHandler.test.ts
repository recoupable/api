import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { Tables } from "@/types/database.types";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { deleteSessionById } from "@/lib/supabase/sessions/deleteSessionById";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { createSessionHandler } from "@/lib/sessions/createSessionHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/sessions/insertSession", () => ({
  insertSession: vi.fn(),
}));

vi.mock("@/lib/supabase/sessions/deleteSessionById", () => ({
  deleteSessionById: vi.fn(),
}));

vi.mock("@/lib/supabase/chats/insertChat", () => ({
  insertChat: vi.fn(),
}));

vi.mock("@/lib/sessions/generateSessionBranchName", () => ({
  generateSessionBranchName: vi.fn(() => "ag/abcd1234"),
}));

type SessionRow = Tables<"sessions">;
type ChatRow = Tables<"chats">;

function makeReq(body: unknown, opts?: { contentType?: string | null }): NextRequest {
  const headers = new Headers();
  if (opts?.contentType !== null) {
    headers.set("Content-Type", opts?.contentType ?? "application/json");
  }
  headers.set("x-api-key", "key_test");
  return new NextRequest("http://localhost/api/sessions", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const baseSessionRow = (overrides: Partial<SessionRow> = {}): SessionRow => ({
  id: "sess_1",
  account_id: "acc-uuid-1",
  title: "Test session",
  status: "running",
  repo_owner: null,
  repo_name: null,
  branch: null,
  clone_url: null,
  is_new_branch: false,
  global_skill_refs: [],
  sandbox_state: { type: "vercel" },
  lifecycle_state: "provisioning",
  lifecycle_version: 0,
  last_activity_at: null,
  sandbox_expires_at: null,
  hibernate_after: null,
  lifecycle_run_id: null,
  lifecycle_error: null,
  lines_added: 0,
  lines_removed: 0,
  snapshot_url: null,
  snapshot_created_at: null,
  snapshot_size_bytes: null,
  cached_diff: null,
  cached_diff_updated_at: null,
  created_at: "2026-05-04T00:00:00.000Z",
  updated_at: "2026-05-04T00:00:00.000Z",
  ...overrides,
});

const baseChatRow = (overrides: Partial<ChatRow> = {}): ChatRow => ({
  id: "chat_1",
  session_id: "sess_1",
  title: "New chat",
  model_id: null,
  active_stream_id: null,
  last_assistant_message_at: null,
  created_at: "2026-05-04T00:00:00.000Z",
  updated_at: "2026-05-04T00:00:00.000Z",
  ...overrides,
});

const okAuth = {
  accountId: "acc-uuid-1",
  orgId: null,
  authToken: "key_test",
};

describe("createSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when validateAuthContext rejects", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "no auth" }, { status: 401 }),
    );

    const res = await createSessionHandler(makeReq({}));

    expect(res.status).toBe(401);
    expect(insertSession).not.toHaveBeenCalled();
  });

  it("returns 400 when sandboxType is not 'vercel'", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);

    const res = await createSessionHandler(makeReq({ sandboxType: "wrong" }));
    expect(res.status).toBe(400);
    expect(insertSession).not.toHaveBeenCalled();
  });

  it("returns 400 when repoOwner has invalid github format", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);

    const res = await createSessionHandler(makeReq({ repoOwner: "bad@@@owner" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when repoName has invalid github format", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);

    const res = await createSessionHandler(makeReq({ repoName: "spaces in name" }));
    expect(res.status).toBe(400);
  });

  it("creates session and chat with defaults on empty body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(baseSessionRow());
    vi.mocked(insertChat).mockResolvedValue(baseChatRow());

    const res = await createSessionHandler(makeReq({}));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { session: { userId: string }; chat: { sessionId: string } };
    expect(body.session.userId).toBe("acc-uuid-1");
    expect(body.chat.sessionId).toBe("sess_1");

    expect(insertSession).toHaveBeenCalledOnce();
    const insertArgs = vi.mocked(insertSession).mock.calls[0][0];
    expect(insertArgs.account_id).toBe("acc-uuid-1");
    expect(insertArgs.status).toBe("running");
    expect(insertArgs.lifecycle_state).toBe("provisioning");
    expect(insertArgs.lifecycle_version).toBe(0);
    expect(insertArgs.is_new_branch).toBe(false);
    expect(insertArgs.sandbox_state).toEqual({ type: "vercel" });

    expect(insertChat).toHaveBeenCalledOnce();
    const chatArgs = vi.mocked(insertChat).mock.calls[0][0];
    expect(chatArgs.session_id).toBe("sess_1");
    expect(chatArgs.title).toBe("New chat");
  });

  it("generates a branch when isNewBranch is true", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(
      baseSessionRow({ branch: "ag/abcd1234", is_new_branch: true }),
    );
    vi.mocked(insertChat).mockResolvedValue(baseChatRow());

    const res = await createSessionHandler(
      makeReq({ isNewBranch: true, branch: "ignored-because-new" }),
    );

    expect(res.status).toBe(200);
    const insertArgs = vi.mocked(insertSession).mock.calls[0][0];
    expect(insertArgs.branch).toBe("ag/abcd1234");
    expect(insertArgs.is_new_branch).toBe(true);
  });

  it("uses provided title when present", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(baseSessionRow({ title: "Hello world" }));
    vi.mocked(insertChat).mockResolvedValue(baseChatRow());

    await createSessionHandler(makeReq({ title: "Hello world" }));

    expect(vi.mocked(insertSession).mock.calls[0][0].title).toBe("Hello world");
  });

  it("returns 500 when insertSession fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(null);

    const res = await createSessionHandler(makeReq({}));

    expect(res.status).toBe(500);
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("rolls back the session and returns 500 when insertChat fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(baseSessionRow({ id: "sess_rollback" }));
    vi.mocked(insertChat).mockResolvedValue(null);

    const res = await createSessionHandler(makeReq({}));

    expect(res.status).toBe(500);
    expect(deleteSessionById).toHaveBeenCalledWith("sess_rollback");
  });
});
