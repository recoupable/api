import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { handleChatWorkflowStream } from "@/lib/chat/handleChatWorkflowStream";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
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

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
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

beforeEach(() => {
  vi.resetAllMocks();
  mockValidated();
  mockSessionOwnedActive();
  mockChatOwned({ active_stream_id: "wrun_existing" });
});

describe("POST admission rejects an unaccepted message during an existing run", () => {
  it.each(["running", "pending"])(
    "rejects a %s run and leaves GET reconnection separate",
    async status => {
      const getReadable = vi.fn(
        () =>
          new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
      );
      vi.mocked(getRun).mockReturnValue({ status: Promise.resolve(status), getReadable } as never);
      const response = await handleChatWorkflowStream(makeRequest());
      expect(response.status).toBe(409);
      expect(response.headers.get("x-workflow-run-id")).toBeNull();
      expect(await response.json()).toMatchObject({
        error: expect.stringContaining("GET /api/chat/"),
      });
      expect(getReadable).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(persistLatestUserMessage).not.toHaveBeenCalled();
      expect(compareAndSetChatActiveStreamId).not.toHaveBeenCalled();
    },
  );
});
