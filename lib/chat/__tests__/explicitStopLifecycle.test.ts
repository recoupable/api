import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { handleResumeChatStream } from "@/lib/chat/handleResumeChatStream";
import { handleStopChatWorkflow } from "@/lib/chat/handleStopChatWorkflow";
import { validateChatOwnership } from "@/lib/chat/validateChatOwnership";
import { validateStopChatWorkflowRequest } from "@/lib/chat/validateStopChatWorkflowRequest";
import { handleChatWorkflowStream } from "@/lib/chat/handleChatWorkflowStream";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
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
const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const CHAT_ID = "11111111-1111-1111-1111-111111111111";

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

vi.mock("@/lib/chat/validateChatOwnership", () => ({ validateChatOwnership: vi.fn() }));
vi.mock("@/lib/chat/validateStopChatWorkflowRequest", () => ({
  validateStopChatWorkflowRequest: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  mockValidated();
  mockSessionOwnedActive();
  mockChatOwned();
  vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({ ok: true, claimed: true });
});
afterEach(() => vi.useRealTimers());

it.each([
  ["", true],
  ["?streamLifecycle=unknown", true],
  ["?streamLifecycle=explicit-stop-v1", false],
  ["?streamLifecycle=explicit-stop-v1&streamLifecycle=unknown", true],
])("POST and GET preserve the disconnect policy for %s", async (query, shouldCancel) => {
  const cancel = vi.fn(async () => {});
  const released = vi.fn();
  let sources = 0;
  const getReadable = vi.fn(() => {
    sources++;
    return Object.assign(
      new ReadableStream({
        start(c) {
          c.enqueue({ type: "text-start", id: "a" });
        },
        cancel: released,
      }),
      { getTailIndex: async () => 23 },
    );
  });
  vi.mocked(start).mockResolvedValue({ runId: "wrun_protocol", getReadable } as never);
  vi.mocked(getRun).mockReturnValue({
    status: Promise.resolve("running"),
    cancel,
    getReadable,
  } as never);
  vi.mocked(validateChatOwnership).mockResolvedValue({
    auth: { accountId: ACCOUNT_ID },
    chat: { id: CHAT_ID, active_stream_id: "wrun_protocol" },
  } as never);
  const post = new NextRequest(`https://api.test/api/chat${query}`, { method: "POST" });
  const response = await handleChatWorkflowStream(post);
  expect(response.status).toBe(200);
  const first = response.body!.getReader();
  await first.read();
  await first.cancel();
  await vi.advanceTimersByTimeAsync(1000);
  expect(cancel).toHaveBeenCalledTimes(shouldCancel ? 1 : 0);
  expect(released).toHaveBeenCalledTimes(1);
  const separator = query ? "&" : "?";
  const resume = await handleResumeChatStream(
    new NextRequest(`https://api.test/api/chat/${CHAT_ID}/stream${query}${separator}startIndex=12`),
    CHAT_ID,
  );
  expect(resume.status).toBe(200);
  expect(resume.headers.get("x-workflow-stream-tail-index")).toBe("23");
  expect(getReadable).toHaveBeenLastCalledWith({ startIndex: 12 });
  const second = resume.body!.getReader();
  await second.read();
  await second.cancel();
  await vi.advanceTimersByTimeAsync(1000);
  expect(cancel).toHaveBeenCalledTimes(shouldCancel ? 2 : 0);
  expect(released).toHaveBeenCalledTimes(sources);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not acknowledge Stop while start is delayed; retries cancel the promoted run and preserve a newer slot", async () => {
  let slot: string | null = null;
  let finishStart!: (run: unknown) => void;
  const cancel = vi.fn(async () => {});
  let status = "running";
  vi.mocked(start).mockImplementation(
    () =>
      new Promise(resolve => {
        finishStart = resolve as never;
      }) as never,
  );
  vi.mocked(compareAndSetChatActiveStreamId).mockImplementation(async (_id, expected, next) => {
    if (slot !== expected) return { ok: true, claimed: false };
    slot = next;
    return { ok: true, claimed: true };
  });
  vi.mocked(validateStopChatWorkflowRequest).mockImplementation(
    async () =>
      ({
        auth: { accountId: ACCOUNT_ID },
        chat: { id: CHAT_ID, active_stream_id: slot },
      }) as never,
  );
  const post = handleChatWorkflowStream(
    new NextRequest("https://api.test/api/chat?streamLifecycle=explicit-stop-v1", {
      method: "POST",
    }),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(slot).toBe("pending-deterministic-uuid");
  const pendingStop = await handleStopChatWorkflow(
    new NextRequest("https://api.test/stop", { method: "POST" }),
    CHAT_ID,
  );
  expect(pendingStop.status).toBe(503);
  expect(await pendingStop.json()).not.toHaveProperty("stopped", true);
  expect(slot).toBe("pending-deterministic-uuid");
  expect(cancel).not.toHaveBeenCalled();
  const getReadable = () =>
    new ReadableStream({
      start(c) {
        c.close();
      },
    });
  vi.mocked(getRun).mockReturnValue({
    cancel,
    get status() {
      return Promise.resolve(status);
    },
  } as never);
  finishStart({ runId: "wrun_delayed", getReadable });
  const started = await post;
  expect(started.status).toBe(200);
  expect(slot).toBe("wrun_delayed");
  const stop = handleStopChatWorkflow(
    new NextRequest("https://api.test/stop", { method: "POST" }),
    CHAT_ID,
  );
  let acknowledged = false;
  void stop.then(() => {
    acknowledged = true;
  });
  await vi.advanceTimersByTimeAsync(100);
  expect(cancel).toHaveBeenCalledExactlyOnceWith();
  expect(acknowledged).toBe(false);
  expect(slot).toBe("wrun_delayed");
  // A late terminal acknowledgement must not clear a newer run's slot.
  slot = "wrun_newer";
  status = "cancelled";
  await vi.advanceTimersByTimeAsync(100);
  expect((await stop).status).toBe(200);
  expect(slot).toBe("wrun_newer");
  await started.text();
  await vi.advanceTimersByTimeAsync(1000);
});
