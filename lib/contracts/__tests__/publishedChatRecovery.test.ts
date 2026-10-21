import Ajv from "ajv";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as startChat } from "@/app/api/chat/route";
import { GET as resumeChat } from "@/app/api/chat/[chatId]/stream/route";
import { GET as listChats, POST as createChat } from "@/app/api/sessions/[sessionId]/chats/route";
import {
  GET as getChat,
  PATCH as patchChat,
  DELETE as removeChat,
} from "@/app/api/sessions/[sessionId]/chats/[chatId]/route";
import { POST as markRead } from "@/app/api/sessions/[sessionId]/chats/[chatId]/read/route";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { persistLatestUserMessage } from "@/lib/chat/persistLatestUserMessage";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { updateChat } from "@/lib/supabase/chats/updateChat";
import { deleteChat } from "@/lib/supabase/chats/deleteChat";
import { upsertChatRead } from "@/lib/supabase/chat_reads/upsertChatRead";
import { start, getRun } from "workflow/api";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/chat/validateChatWorkflow", () => ({ validateChatWorkflow: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));
vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));
vi.mock("@/lib/chat/persistLatestUserMessage", () => ({ persistLatestUserMessage: vi.fn() }));
vi.mock("@/lib/supabase/chats/insertChat", () => ({ insertChat: vi.fn() }));
vi.mock("@/lib/supabase/chats/updateChat", () => ({ updateChat: vi.fn() }));
vi.mock("@/lib/supabase/chats/deleteChat", () => ({ deleteChat: vi.fn() }));
vi.mock("@/lib/supabase/chat_reads/upsertChatRead", () => ({ upsertChatRead: vi.fn() }));
vi.mock("@/lib/supabase/chat_reads/selectChatReads", () => ({ selectChatReads: vi.fn() }));
vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({ selectChatMessages: vi.fn() }));
vi.mock("@/lib/supabase/sessions/updateSession", () => ({ updateSession: vi.fn() }));
vi.mock("@/lib/sandbox/isSandboxActive", () => ({ isSandboxActive: vi.fn(() => true) }));
vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({ connectVercel: vi.fn() }));
vi.mock("@/lib/skills/discoverSkills", () => ({ discoverSkills: vi.fn() }));
vi.mock("@/lib/skills/getSandboxSkillDirectories", () => ({ getSandboxSkillDirectories: vi.fn() }));
vi.mock("@/app/lib/workflows/runAgentWorkflow", () => ({ runAgentWorkflow: vi.fn() }));
vi.mock("workflow/api", () => ({ start: vi.fn(), getRun: vi.fn() }));

const chatId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const accountId = "33333333-3333-4333-8333-333333333333";
const listPath = "/api/sessions/{sessionId}/chats";
const chatPath = `${listPath}/{chatId}`;
const resumePath = "/api/chat/{chatId}/stream";
const params = { params: Promise.resolve({ sessionId, chatId }) };
const ajv = new Ajv({ allErrors: true });
ajv.addKeyword({ keyword: "example", valid: true });

function responseContract(method: string, path: string, status: number) {
  const contract = fixture.responseSchemas.find(
    candidate =>
      candidate.method === method && candidate.path === path && candidate.status === status,
  );
  expect(contract, `Missing ${method} ${path} ${status} response contract`).toBeDefined();
  return ajv.compile(contract!.schema);
}

function request(method: string, path: string, body?: unknown) {
  return new NextRequest(`https://api.example${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "synthetic",
  });
  vi.mocked(validateChatWorkflow).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "synthetic",
    chatId,
    sessionId,
    messages: [
      { id: "synthetic-message", role: "user", parts: [{ type: "text", text: "Next turn" }] },
    ],
  });
  vi.mocked(selectSessions).mockResolvedValue([
    { id: sessionId, account_id: accountId, sandbox_state: { ready: true } } as never,
  ]);
  vi.mocked(selectChats).mockResolvedValue([
    {
      id: chatId,
      session_id: sessionId,
      active_stream_id: "wrun_existing",
      model_id: null,
    } as never,
  ]);
});

describe("published chat recovery contracts against canonical route exports", () => {
  it.each(["running", "pending"])(
    "binds the early %s conflict to the published 409",
    async status => {
      const getReadable = vi.fn();
      vi.mocked(getRun).mockReturnValue({ status: Promise.resolve(status), getReadable } as never);
      const response = await startChat(request("POST", "/api/chat", {}));
      expect(response.status).toBe(409);
      const validate = responseContract("POST", "/api/chat", 409);
      const body = await response.json();
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
      expect(body.error).toContain("GET /api/chat/{chatId}/stream");
      expect(validate({ status: "error" })).toBe(false);
      expect(validate({ status: "success", error: "conflict" })).toBe(false);
      expect(getReadable).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(persistLatestUserMessage).not.toHaveBeenCalled();
      expect(compareAndSetChatActiveStreamId).not.toHaveBeenCalled();
    },
  );

  it.each(["status lookup", "stale-slot clear"])("binds unresolved %s to 503", async failure => {
    vi.mocked(getRun).mockReturnValue({
      status:
        failure === "status lookup"
          ? Promise.reject(new Error("synthetic"))
          : Promise.resolve("completed"),
    } as never);
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({ ok: false, error: "synthetic" });
    const response = await startChat(request("POST", "/api/chat", {}));
    expect(response.status).toBe(503);
    const validate = responseContract("POST", "/api/chat", 503);
    expect(validate(await response.json()), JSON.stringify(validate.errors)).toBe(true);
    expect(start).not.toHaveBeenCalled();
    expect(persistLatestUserMessage).not.toHaveBeenCalled();
  });

  it("binds the POST failed chat read to 500 before starting a turn", async () => {
    vi.mocked(selectChats).mockResolvedValue(null);
    const response = await startChat(request("POST", "/api/chat", {}));
    expect(response.status).toBe(500);
    const validate = responseContract("POST", "/api/chat", 500);
    expect(validate(await response.json()), JSON.stringify(validate.errors)).toBe(true);
    expect(start).not.toHaveBeenCalled();
    expect(persistLatestUserMessage).not.toHaveBeenCalled();
  });

  it("binds the GET failed chat read to 500 rather than missing chat", async () => {
    vi.mocked(selectChats).mockResolvedValue(null);
    const response = await resumeChat(request("GET", `/api/chat/${chatId}/stream`), params);
    expect(response.status).toBe(500);
    const validate = responseContract("GET", resumePath, 500);
    expect(validate(await response.json()), JSON.stringify(validate.errors)).toBe(true);
  });

  it("preserves GET 502 when a run status cannot be read", async () => {
    vi.mocked(getRun).mockReturnValue({ status: Promise.reject(new Error("synthetic")) } as never);
    const response = await resumeChat(request("GET", `/api/chat/${chatId}/stream`), params);
    expect(response.status).toBe(502);
    const validate = responseContract("GET", resumePath, 502);
    expect(validate(await response.json()), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each([null, "completed", "cancelled", "failed"])(
    "preserves GET finish-only 200 for %s",
    async status => {
      vi.mocked(selectChats).mockResolvedValue([
        {
          id: chatId,
          session_id: sessionId,
          active_stream_id: status === null ? null : "wrun_existing",
        } as never,
      ]);
      vi.mocked(getRun).mockReturnValue({ status: Promise.resolve(status) } as never);
      vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({ ok: true, claimed: true });
      const response = await resumeChat(request("GET", `/api/chat/${chatId}/stream`), params);
      expect(response.status).toBe(fixture.contracts.resumeNoActiveStatus);
      expect(response.status).toBe(200);
      expect(fixture.contracts.resumeResponses).not.toContain("204");
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(response.headers.get("x-workflow-run-id")).toBeNull();
      expect(response.headers.get("x-workflow-stream-tail-index")).toBeNull();
      expect(await response.text()).toContain('"type":"finish"');
    },
  );

  it.each([
    { method: "GET", path: listPath, route: listChats, body: undefined },
    { method: "POST", path: listPath, route: createChat, body: { id: chatId } },
    { method: "GET", path: chatPath, route: getChat, body: undefined },
    { method: "PATCH", path: chatPath, route: patchChat, body: { title: "Updated" } },
    { method: "DELETE", path: chatPath, route: removeChat, body: undefined },
    { method: "POST", path: `${chatPath}/read`, route: markRead, body: {} },
  ])(
    "binds failed lookup for $method $path to 500 without writing",
    async ({ method, path, route, body }) => {
      vi.mocked(selectChats).mockResolvedValue(null);
      const url = path.replace("{sessionId}", sessionId).replace("{chatId}", chatId);
      const response = await route(request(method, url, body), params);
      expect(response.status).toBe(500);
      const validate = responseContract(method, path, 500);
      expect(validate(await response.json()), JSON.stringify(validate.errors)).toBe(true);
      expect(validate({ error: "lookup failed" })).toBe(false);
      expect(validate({ status: "error", message: "lookup failed" })).toBe(false);
      expect(insertChat).not.toHaveBeenCalled();
      expect(updateChat).not.toHaveBeenCalled();
      expect(deleteChat).not.toHaveBeenCalled();
      expect(upsertChatRead).not.toHaveBeenCalled();
    },
  );
});
