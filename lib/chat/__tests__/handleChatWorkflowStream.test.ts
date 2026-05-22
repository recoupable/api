import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { handleChatWorkflowStream } from "@/lib/chat/handleChatWorkflowStream";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";
import { persistLatestUserMessage } from "@/lib/chat/persistLatestUserMessage";
import { start, getRun } from "workflow/api";

vi.mock("@/lib/chat/validateChatWorkflow", () => ({ validateChatWorkflow: vi.fn() }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));
vi.mock("@/lib/sandbox/isSandboxActive", () => ({ isSandboxActive: vi.fn() }));
vi.mock("@/lib/supabase/sessions/updateSession", () => ({ updateSession: vi.fn() }));
vi.mock("@/lib/sandbox/buildActiveLifecycleUpdate", () => ({
  buildActiveLifecycleUpdate: vi.fn(() => ({})),
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
vi.mock("@/app/lib/workflows/runAgentWorkflow", () => ({ runAgentWorkflow: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/uuid/generateUUID", () => ({ default: vi.fn(() => "deterministic-uuid") }));

// Stub sandbox connection + skill discovery so handler tests don't actually
// try to talk to Vercel Sandbox / parse SKILL.md files. The handler treats
// discovery failures as non-fatal (empty catalog), but we mock to keep tests fast.
vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(async () => ({ workingDirectory: "/sandbox/mono" })),
}));
vi.mock("@/lib/skills/discoverSkills", () => ({
  discoverSkills: vi.fn(async () => []),
}));
vi.mock("@/lib/skills/getSandboxSkillDirectories", () => ({
  getSandboxSkillDirectories: vi.fn(() => ["/sandbox/mono/skills"]),
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
    { id: SESSION_ID, account_id: ACCOUNT_ID, sandbox_state: { ready: true }, ...extra } as never,
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

function mockStartedRun(runId = "wrun_test_run_1") {
  const stream = new ReadableStream<unknown>({
    start(controller) {
      controller.enqueue({ type: "text-start", id: "a" });
      controller.close();
    },
  });
  vi.mocked(start).mockResolvedValue({ runId, getReadable: () => stream } as never);
  vi.mocked(getRun).mockReturnValue({ cancel: vi.fn(() => Promise.resolve()) } as never);
  return { runId, stream };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: a stale/terminal active stream that self-heals to "ready" so the
  // POST proceeds. Only invoked when the chat has an active_stream_id.
  vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "ready" });
});

describe("handleChatWorkflowStream", () => {
  describe("short-circuit responses", () => {
    it("passes through the validator's response (401/400)", async () => {
      vi.mocked(validateChatWorkflow).mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(401);
      expect(start).not.toHaveBeenCalled();
    });

    it("returns 500 when selectSessions errors", async () => {
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

    it("returns 403 when session not owned", async () => {
      mockValidated();
      vi.mocked(selectSessions).mockResolvedValue([
        { id: SESSION_ID, account_id: OTHER_ACCOUNT_ID, sandbox_state: {} } as never,
      ]);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(403);
    });

    it("returns 400 when sandbox is inactive", async () => {
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
  });

  describe("active stream handling (start-only; never resumes)", () => {
    beforeEach(() => {
      mockValidated();
      mockSessionOwnedActive();
      mockChatOwned({ active_stream_id: "wrun_existing" });
    });

    it("returns 409 without starting when a run is live (reconcile=resume)", async () => {
      vi.mocked(reconcileExistingActiveStream).mockResolvedValue({
        action: "resume",
        runId: "wrun_existing",
        stream: new ReadableStream(),
      });
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(409);
      expect(start).not.toHaveBeenCalled();
    });

    it("returns 409 without starting when reconcile is indeterminate (conflict)", async () => {
      vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "conflict" });
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(409);
      expect(start).not.toHaveBeenCalled();
    });

    it("starts a fresh run when a terminal stale id self-heals (reconcile=ready)", async () => {
      vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "ready" });
      vi.mocked(compareAndSetChatActiveStreamId)
        .mockResolvedValueOnce({ ok: true, claimed: true })
        .mockResolvedValueOnce({ ok: true, claimed: true });
      mockStartedRun();
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(200);
      expect(start).toHaveBeenCalled();
    });
  });

  describe("placeholder CAS before start", () => {
    beforeEach(() => {
      mockValidated();
      mockSessionOwnedActive();
      mockChatOwned();
    });

    it("returns 500 when the placeholder-CAS hits a DB error", async () => {
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValueOnce({
        ok: false,
        error: "down",
      });
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(500);
      expect(start).not.toHaveBeenCalled();
    });

    it("returns 409 (without calling start) when the placeholder-CAS loses the race", async () => {
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValueOnce({
        ok: true,
        claimed: false,
      });
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(409);
      expect(start).not.toHaveBeenCalled();
    });

    it("starts the workflow only after placeholder CAS succeeds", async () => {
      // First CAS = placeholder claim, second CAS = promote placeholder → real run id
      vi.mocked(compareAndSetChatActiveStreamId)
        .mockResolvedValueOnce({ ok: true, claimed: true })
        .mockResolvedValueOnce({ ok: true, claimed: true });
      mockStartedRun();
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(200);
      expect(start).toHaveBeenCalled();
      // Confirm CAS-before-start ordering — first CAS pre-claims with expected=null
      const firstCallArgs = vi.mocked(compareAndSetChatActiveStreamId).mock.calls[0];
      expect(firstCallArgs?.[0]).toBe(CHAT_ID);
      expect(firstCallArgs?.[1]).toBeNull();
      expect(firstCallArgs?.[2]).toMatch(/^pending-/);
    });
  });

  describe("happy path", () => {
    beforeEach(() => {
      mockValidated();
      mockSessionOwnedActive();
      mockChatOwned();
      vi.mocked(compareAndSetChatActiveStreamId)
        .mockResolvedValueOnce({ ok: true, claimed: true })
        .mockResolvedValueOnce({ ok: true, claimed: true });
    });

    it("returns 200 with text/event-stream and x-workflow-run-id", async () => {
      const { runId } = mockStartedRun("wrun_abc_123");
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toMatch(/text\/event-stream/);
      expect(res.headers.get("x-workflow-run-id")).toBe(runId);
    });

    it("refreshes session lifecycle activity", async () => {
      mockStartedRun();
      await handleChatWorkflowStream(makeRequest());
      expect(updateSession).toHaveBeenCalledWith(SESSION_ID, expect.any(Object));
    });

    it("fire-and-forgets persistLatestUserMessage", async () => {
      mockStartedRun();
      await handleChatWorkflowStream(makeRequest());
      expect(persistLatestUserMessage).toHaveBeenCalledWith(CHAT_ID, []);
    });

    it("passes chat.model_id into the workflow when set", async () => {
      vi.mocked(selectChats).mockResolvedValue([
        {
          id: CHAT_ID,
          session_id: SESSION_ID,
          active_stream_id: null,
          model_id: "anthropic/claude-opus-4.6",
        } as never,
      ]);
      mockStartedRun();
      await handleChatWorkflowStream(makeRequest());
      const startArgs = vi.mocked(start).mock.calls[0]?.[1]?.[0] as { modelId: string };
      expect(startArgs.modelId).toBe("anthropic/claude-opus-4.6");
    });

    it("falls back to the default model when chat.model_id is null", async () => {
      mockStartedRun();
      await handleChatWorkflowStream(makeRequest());
      const startArgs = vi.mocked(start).mock.calls[0]?.[1]?.[0] as { modelId: string };
      expect(startArgs.modelId).toBe("anthropic/claude-haiku-4.5");
    });
  });

  describe("promote placeholder → run id", () => {
    beforeEach(() => {
      mockValidated();
      mockSessionOwnedActive();
      mockChatOwned();
    });

    it("awaits cancel() and returns 409 if promote loses", async () => {
      vi.mocked(compareAndSetChatActiveStreamId)
        .mockResolvedValueOnce({ ok: true, claimed: true }) // claim ok
        .mockResolvedValueOnce({ ok: true, claimed: false }); // promote raced
      const cancel = vi.fn(() => Promise.resolve());
      vi.mocked(start).mockResolvedValue({
        runId: "wrun_lost",
        getReadable: () => new ReadableStream(),
      } as never);
      vi.mocked(getRun).mockReturnValue({ cancel } as never);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(409);
      expect(getRun).toHaveBeenCalledWith("wrun_lost");
      expect(cancel).toHaveBeenCalled();
    });

    it("still returns 409 if cancel() throws (best-effort)", async () => {
      vi.mocked(compareAndSetChatActiveStreamId)
        .mockResolvedValueOnce({ ok: true, claimed: true })
        .mockResolvedValueOnce({ ok: true, claimed: false });
      vi.mocked(start).mockResolvedValue({
        runId: "wrun_lost",
        getReadable: () => new ReadableStream(),
      } as never);
      // Wrap rejection in an async IIFE + attach a noop handler so Vitest's
      // unhandled-rejection watcher doesn't fire before the SUT awaits.
      const cancelRejection = (async () => {
        throw new Error("cancel exploded");
      })();
      cancelRejection.catch(() => {
        /* SUT will await this and convert to logged catch */
      });
      vi.mocked(getRun).mockReturnValue({
        cancel: vi.fn(() => cancelRejection),
      } as never);
      const res = await handleChatWorkflowStream(makeRequest());
      expect(res.status).toBe(409);
    });
  });
});
