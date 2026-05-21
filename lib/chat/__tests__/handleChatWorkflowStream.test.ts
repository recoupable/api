import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { handleChatWorkflowStream } from "@/lib/chat/handleChatWorkflowStream";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { compareAndSetChatActiveStreamId } from "@/lib/supabase/chats/compareAndSetChatActiveStreamId";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";
import { persistLatestUserMessage } from "@/lib/chat/persistLatestUserMessage";
import { start, getRun } from "workflow/api";

vi.mock("@/lib/chat/validateChatWorkflow", () => ({ validateChatWorkflow: vi.fn() }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/sandbox/isSandboxActive", () => ({ isSandboxActive: vi.fn() }));
vi.mock("@/lib/supabase/sessions/updateSession", () => ({ updateSession: vi.fn() }));
vi.mock("@/lib/sandbox/buildActiveLifecycleUpdate", () => ({
  buildActiveLifecycleUpdate: vi.fn(() => ({})),
}));
vi.mock("@/lib/supabase/chats/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));
vi.mock("@/lib/chat/reconcileExistingActiveStream", () => ({
  reconcileExistingActiveStream: vi.fn(),
}));
vi.mock("@/lib/chat/persistLatestUserMessage", () => ({
  persistLatestUserMessage: vi.fn(),
}));
vi.mock("workflow/api", () => ({
  start: vi.fn(),
  getRun: vi.fn(),
}));
vi.mock("@/app/workflows/runAgentWorkflow", () => ({ runAgentWorkflow: vi.fn() }));
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

function mockValidated() {
  vi.mocked(validateChatWorkflow).mockResolvedValue({
    messages: [],
    chatId: CHAT_ID,
    sessionId: SESSION_ID,
    accountId: ACCOUNT_ID,
    orgId: null,
    authToken: "test-key",
  });
}

function mockSessionOwnedActive(extra: Record<string, unknown> = {}) {
  vi.mocked(selectSessions).mockResolvedValue([
    {
      id: SESSION_ID,
      account_id: ACCOUNT_ID,
      sandbox_state: { ready: true },
      ...extra,
    } as never,
  ]);
  vi.mocked(isSandboxActive).mockReturnValue(true);
}

function mockChatOwned(extra: Record<string, unknown> = {}) {
  vi.mocked(selectChats).mockResolvedValue([
    {
      id: CHAT_ID,
      session_id: SESSION_ID,
      active_stream_id: null,
      model_id: null,
      ...extra,
    } as never,
  ]);
}

function mockRun(runId = "wrun_test_run_1") {
  const stream = new ReadableStream<unknown>({
    start(controller) {
      controller.enqueue({ type: "text-start", id: "a" });
      controller.enqueue({ type: "text-delta", id: "a", delta: "hello" });
      controller.enqueue({ type: "text-end", id: "a" });
      controller.close();
    },
  });
  vi.mocked(start).mockResolvedValue({ runId, getReadable: () => stream } as never);
  vi.mocked(getRun).mockReturnValue({ cancel: vi.fn() } as never);
  return { runId, stream };
}

beforeEach(() => vi.clearAllMocks());

describe("handleChatWorkflowStream", () => {
  describe("short-circuit responses (pre-workflow checks)", () => {
    it("returns the validator's response unchanged (401/400)", async () => {
      vi.mocked(validateChatWorkflow).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(401);
      expect(start).not.toHaveBeenCalled();
    });

    it("returns 500 when selectSessions errors (returns null)", async () => {
      mockValidated();
      vi.mocked(selectSessions).mockResolvedValue(null);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(500);
    });

    it("returns 404 when session does not exist", async () => {
      mockValidated();
      vi.mocked(selectSessions).mockResolvedValue([]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(404);
    });

    it("returns 403 when session not owned by the API key's account", async () => {
      mockValidated();
      vi.mocked(selectSessions).mockResolvedValue([
        { id: SESSION_ID, account_id: OTHER_ACCOUNT_ID, sandbox_state: {} } as never,
      ]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(403);
    });

    it("returns 400 'Sandbox not initialized' when sandbox is inactive", async () => {
      mockValidated();
      vi.mocked(selectSessions).mockResolvedValue([
        { id: SESSION_ID, account_id: ACCOUNT_ID, sandbox_state: null } as never,
      ]);
      vi.mocked(isSandboxActive).mockReturnValue(false);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(400);
    });

    it("returns 404 when chat does not exist", async () => {
      mockValidated();
      mockSessionOwnedActive();
      vi.mocked(selectChats).mockResolvedValue([]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(404);
    });

    it("returns 404 when chat belongs to a different session", async () => {
      mockValidated();
      mockSessionOwnedActive();
      vi.mocked(selectChats).mockResolvedValue([
        { id: CHAT_ID, session_id: "different", active_stream_id: null } as never,
      ]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(404);
    });
  });

  describe("resume / conflict on existing active_stream_id", () => {
    beforeEach(() => {
      mockValidated();
      mockSessionOwnedActive();
      mockChatOwned({ active_stream_id: "wrun_existing" });
    });

    it("resumes an in-flight workflow stream and includes x-workflow-run-id", async () => {
      const stream = new ReadableStream();
      vi.mocked(reconcileExistingActiveStream).mockResolvedValue({
        action: "resume",
        runId: "wrun_existing",
        stream,
      });
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(200);
      expect(res.headers.get("x-workflow-run-id")).toBe("wrun_existing");
      expect(start).not.toHaveBeenCalled();
    });

    it("returns 409 when reconcile reports conflict", async () => {
      vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "conflict" });
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(409);
      expect(start).not.toHaveBeenCalled();
    });

    it("falls through to start a new workflow when reconcile returns ready", async () => {
      vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "ready" });
      mockRun();
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(200);
      expect(start).toHaveBeenCalled();
    });
  });

  describe("happy path — start workflow + CAS the run id", () => {
    beforeEach(() => {
      mockValidated();
      mockSessionOwnedActive();
      mockChatOwned();
    });

    it("returns 200 with text/event-stream Content-Type", async () => {
      mockRun();
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toMatch(/text\/event-stream/);
    });

    it("sets x-workflow-run-id to the started run's id", async () => {
      const { runId } = mockRun("wrun_abc_123");
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.headers.get("x-workflow-run-id")).toBe(runId);
    });

    it("refreshes session lifecycle activity before starting the workflow", async () => {
      mockRun();
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
      await handleChatWorkflowStream(makeRequest());
      expect(updateSession).toHaveBeenCalledWith(SESSION_ID, expect.any(Object));
    });

    it("fire-and-forgets persistLatestUserMessage", async () => {
      mockRun();
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
      await handleChatWorkflowStream(makeRequest());
      expect(persistLatestUserMessage).toHaveBeenCalledWith(CHAT_ID, []);
    });

    it("passes the chat's model_id into the workflow start payload", async () => {
      mockChatOwned({ model_id: "anthropic/claude-opus-4.6" });
      mockRun();
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
      await handleChatWorkflowStream(makeRequest());
      const callArg = vi.mocked(start).mock.calls[0]?.[1]?.[0] as { modelId: string };
      expect(callArg.modelId).toBe("anthropic/claude-opus-4.6");
    });

    it("defaults to claude-haiku-4.5 when chat has no model_id", async () => {
      mockRun();
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
      await handleChatWorkflowStream(makeRequest());
      const callArg = vi.mocked(start).mock.calls[0]?.[1]?.[0] as { modelId: string };
      expect(callArg.modelId).toBe("anthropic/claude-haiku-4.5");
    });
  });

  describe("CAS race", () => {
    beforeEach(() => {
      mockValidated();
      mockSessionOwnedActive();
      mockChatOwned();
    });

    it("cancels the started workflow and returns 409 when CAS loses", async () => {
      const cancel = vi.fn();
      mockRun("wrun_dup");
      vi.mocked(getRun).mockReturnValue({ cancel } as never);
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(false);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(409);
      expect(getRun).toHaveBeenCalledWith("wrun_dup");
      expect(cancel).toHaveBeenCalled();
    });

    it("still returns 409 even if cancel() throws", async () => {
      mockRun("wrun_dup");
      vi.mocked(getRun).mockImplementation(() => {
        throw new Error("not found");
      });
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(false);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(409);
    });
  });
});
