import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

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
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { validatePatchSessionChatRequest } = await import(
  "@/lib/sessions/chats/validatePatchSessionChatRequest"
);

const accountId = "acc-uuid-1";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawReq(rawBody: string): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

function happyPathMocks() {
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "tok",
  });
  vi.mocked(selectSessions).mockResolvedValue([
    baseSessionRow({ id: "sess_1", account_id: accountId }),
  ]);
  vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1", session_id: "sess_1" })]);
}

describe("validatePatchSessionChatRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the auth NextResponse when validateAuthContext rejects", async () => {
    const failure = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const res = await validatePatchSessionChatRequest(makeReq({ title: "x" }), "sess_1", "chat_1");
    expect(res).toBe(failure);
  });

  it("returns 404 when the session is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await validatePatchSessionChatRequest(
      makeReq({ title: "x" }),
      "sess_missing",
      "chat_1",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
    }
  });

  it("returns 403 when the session belongs to a different account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: "acc-OTHER" }),
    ]);

    const res = await validatePatchSessionChatRequest(makeReq({ title: "x" }), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
    }
  });

  it("returns 500 when chat lookup fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue(null);

    const res = await validatePatchSessionChatRequest(makeReq({ title: "x" }), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Internal server error",
      });
    }
  });

  it("returns 404 when the chat does not belong to the session", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_1", session_id: "sess_OTHER" }),
    ]);

    const res = await validatePatchSessionChatRequest(makeReq({ title: "x" }), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
    }
  });

  it("returns 400 on invalid JSON", async () => {
    happyPathMocks();
    const res = await validatePatchSessionChatRequest(makeRawReq("not json"), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Invalid JSON body",
      });
    }
  });

  it("returns 400 when neither title nor modelId is provided", async () => {
    happyPathMocks();
    const res = await validatePatchSessionChatRequest(makeReq({}), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("At least one field is required");
    }
  });

  it("returns 400 when the body contains unknown fields", async () => {
    happyPathMocks();
    const res = await validatePatchSessionChatRequest(
      makeReq({ title: "Renamed", foo: "bar" }),
      "sess_1",
      "chat_1",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 when title is whitespace-only", async () => {
    happyPathMocks();
    const res = await validatePatchSessionChatRequest(
      makeReq({ title: "   " }),
      "sess_1",
      "chat_1",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
    }
  });

  it("returns the validated patch with title trimmed", async () => {
    happyPathMocks();
    const res = await validatePatchSessionChatRequest(
      makeReq({ title: "  Renamed  " }),
      "sess_1",
      "chat_1",
    );
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res).toEqual({ title: "Renamed" });
    }
  });

  it("returns the validated patch when modelId is provided", async () => {
    happyPathMocks();
    const res = await validatePatchSessionChatRequest(
      makeReq({ modelId: "openai/gpt-5-mini" }),
      "sess_1",
      "chat_1",
    );
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res).toEqual({ modelId: "openai/gpt-5-mini" });
    }
  });
});
