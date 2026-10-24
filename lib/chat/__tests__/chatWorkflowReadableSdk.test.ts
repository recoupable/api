import { it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { GET as handleResumeChatStream } from "@/app/api/chat/[chatId]/stream/route";
import { validateChatOwnership } from "@/lib/chat/validateChatOwnership";
import { POST as handleChatWorkflowStream } from "@/app/api/chat/route";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { start, getRun } from "workflow/api";
import { setWorld } from "@workflow/core/runtime";

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
vi.mock("workflow/api", async importOriginal => ({
  ...(await importOriginal<typeof import("workflow/api")>()),
  start: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockValidated();
  mockSessionOwnedActive();
  mockChatOwned();
  vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({ ok: true, claimed: true });
});

const runId = "wrun_synthetic_sdk_boundary";
function syntheticWorld(mode: "cancel" | "eof" | "error") {
  let entered!: () => void;
  const subscribed = new Promise<void>(resolve => {
    entered = resolve;
  });
  const events = vi.fn(async () => ({}));
  const release = vi.fn();
  setWorld({
    runs: { get: async () => ({ runId, status: "running" }) },
    events: { create: events },
    getStreamInfo: async () => ({ tailIndex: 17 }),
    readFromStream: async () => {
      const raw = new ReadableStream<Uint8Array>({
        type: "bytes",
        start(controller) {
          if (mode === "eof") controller.close();
          if (mode === "error") controller.error(new Error("synthetic SDK stream failure"));
        },
        cancel: release,
      });
      entered();
      return raw;
    },
  } as never);
  vi.mocked(start).mockResolvedValue(getRun(runId) as never);
  vi.mocked(validateChatOwnership).mockResolvedValue({
    auth: { accountId: ACCOUNT_ID },
    chat: { id: CHAT_ID, active_stream_id: runId },
  } as never);
  return { subscribed, events, release };
}
async function open(route: string, explicit: boolean) {
  const query = explicit ? "?streamLifecycle=explicit-stop-v1" : "";
  return route === "POST"
    ? handleChatWorkflowStream(
        new NextRequest(`https://api.test/api/chat${query}`, { method: "POST" }),
      )
    : handleResumeChatStream(
        new NextRequest(`https://api.test/api/chat/${CHAT_ID}/stream${query}`),
        { params: Promise.resolve({ chatId: CHAT_ID }) },
      );
}

it.each([
  ["POST", true],
  ["GET", true],
  ["POST", false],
  ["GET", false],
])("real SDK %s reader cancellation owns completion; explicit=%s", async (route, explicit) => {
  const world = syntheticWorld("cancel");
  const response = await open(route, explicit);
  expect(response.status).toBe(200);
  if (route === "GET") expect(response.headers.get("x-workflow-stream-tail-index")).toBe("17");
  const reader = response.body!.getReader();
  const pending = reader.read();
  await world.subscribed;
  await reader.cancel();
  await pending;
  reader.releaseLock();
  // Real time and Node strict-rejection mode expose the SDK completion promise.
  await new Promise(resolve => setTimeout(resolve, 550));
  expect(world.events).toHaveBeenCalledTimes(explicit ? 0 : 1);
  if (!explicit)
    expect(world.events.mock.calls[0]).toEqual([
      runId,
      expect.objectContaining({ eventType: "run_cancelled" }),
    ]);
  expect(world.release).toHaveBeenCalledTimes(1);
});

it.each(["POST", "GET"])("real SDK %s natural EOF completes normally", async route => {
  syntheticWorld("eof");
  const response = await open(route, true);
  expect(response.status).toBe(200);
  await expect(response.text()).resolves.toContain("[DONE]");
  await new Promise(resolve => setTimeout(resolve, 550));
});

it.each(["POST", "GET"])("real SDK %s propagates unexpected source errors", async route => {
  syntheticWorld("error");
  const response = await open(route, true);
  await expect(response.text()).rejects.toThrow("synthetic SDK stream failure");
  await new Promise(resolve => setTimeout(resolve, 550));
});
