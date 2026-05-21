import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { handleChatWorkflowStream } from "@/lib/chat/handleChatWorkflowStream";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";

vi.mock("@/lib/chat/validateChatWorkflow", () => ({
  validateChatWorkflow: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));
vi.mock("@/lib/sandbox/isSandboxActive", () => ({
  isSandboxActive: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_ACCOUNT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const CHAT_ID = "11111111-1111-1111-1111-111111111111";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/chat/workflow", {
    method: "POST",
    headers: { "x-api-key": "test-key", "content-type": "application/json" },
    body: JSON.stringify({ messages: [], chatId: CHAT_ID, sessionId: SESSION_ID }),
  });
}

function mockValidatedRequest(overrides: Partial<{ accountId: string }> = {}) {
  vi.mocked(validateChatWorkflow).mockResolvedValue({
    messages: [],
    chatId: CHAT_ID,
    sessionId: SESSION_ID,
    accountId: overrides.accountId ?? ACCOUNT_ID,
    orgId: null,
    authToken: "test-key",
  });
}

function mockOwnedSessionWithActiveSandbox() {
  mockValidatedRequest();
  vi.mocked(selectSessions).mockResolvedValue([
    { id: SESSION_ID, account_id: ACCOUNT_ID, sandbox_state: { ready: true } } as never,
  ]);
  vi.mocked(selectChats).mockResolvedValue([{ id: CHAT_ID, session_id: SESSION_ID } as never]);
  vi.mocked(isSandboxActive).mockReturnValue(true);
}

describe("handleChatWorkflowStream (stub)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation short-circuits", () => {
    it("returns the validator's short-circuit response unchanged (e.g. 401)", async () => {
      const authError = NextResponse.json(
        { status: "error", error: "Unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateChatWorkflow).mockResolvedValue(authError);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(401);
    });

    it("returns the validator's 400 unchanged (e.g. invalid body)", async () => {
      const badBody = NextResponse.json(
        { status: "error", error: "Invalid JSON body" },
        { status: 400 },
      );
      vi.mocked(validateChatWorkflow).mockResolvedValue(badBody);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(400);
    });
  });

  describe("session / chat ownership", () => {
    beforeEach(() => mockValidatedRequest());

    it("returns 404 when the session does not exist", async () => {
      vi.mocked(selectSessions).mockResolvedValue([]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(404);
    });

    it("returns 500 when selectSessions errors (returns null)", async () => {
      vi.mocked(selectSessions).mockResolvedValue(null);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(500);
    });

    it("returns 403 when the session is owned by a different account", async () => {
      vi.mocked(selectSessions).mockResolvedValue([
        { id: SESSION_ID, account_id: OTHER_ACCOUNT_ID, sandbox_state: { ready: true } } as never,
      ]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(403);
    });

    it("returns 400 'Sandbox not initialized' when sandbox is inactive", async () => {
      vi.mocked(selectSessions).mockResolvedValue([
        { id: SESSION_ID, account_id: ACCOUNT_ID, sandbox_state: null } as never,
      ]);
      vi.mocked(isSandboxActive).mockReturnValue(false);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/sandbox/i);
    });

    it("returns 404 when the chat does not exist", async () => {
      vi.mocked(selectSessions).mockResolvedValue([
        { id: SESSION_ID, account_id: ACCOUNT_ID, sandbox_state: { ready: true } } as never,
      ]);
      vi.mocked(isSandboxActive).mockReturnValue(true);
      vi.mocked(selectChats).mockResolvedValue([]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(404);
    });

    it("returns 404 when chat exists but belongs to a different session", async () => {
      vi.mocked(selectSessions).mockResolvedValue([
        { id: SESSION_ID, account_id: ACCOUNT_ID, sandbox_state: { ready: true } } as never,
      ]);
      vi.mocked(isSandboxActive).mockReturnValue(true);
      vi.mocked(selectChats).mockResolvedValue([
        { id: CHAT_ID, session_id: "different-session" } as never,
      ]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(404);
    });
  });

  describe("success (stub response)", () => {
    beforeEach(() => mockOwnedSessionWithActiveSandbox());

    it("returns 200 with text/event-stream content type", async () => {
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toMatch(/text\/event-stream/);
    });

    it("sets an x-workflow-run-id response header starting with stub-", async () => {
      const res = await handleChatWorkflowStream(makeRequest());
      const runId = res.headers.get("x-workflow-run-id");
      expect(runId).toBeTruthy();
      expect(runId!.startsWith("stub-")).toBe(true);
    });

    it("emits a stream body that includes the stub assistant text", async () => {
      const res = await handleChatWorkflowStream(makeRequest());
      const text = await res.text();
      expect(text).toContain("Hello from /api/chat/workflow");
    });
  });
});
