import Ajv from "ajv";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/chats/[id]/messages/trailing/route";
import fixture from "../fixtures/published-docs.json";

const mock = vi.hoisted(() => ({
  chats: vi.fn(),
  sessions: vi.fn(),
  messages: vi.fn(),
  remove: vi.fn(),
  keyAccount: vi.fn(),
  bearerAccount: vi.fn(),
  override: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: mock.chats }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: mock.sessions }));
vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: mock.messages,
}));
vi.mock("@/lib/supabase/chat_messages/deleteTrailingChatMessages", () => ({
  deleteTrailingChatMessages: mock.remove,
}));
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({ getApiKeyAccountId: mock.keyAccount }));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: mock.bearerAccount,
}));
vi.mock("@/lib/auth/validateAccountIdOverride", () => ({
  validateAccountIdOverride: mock.override,
}));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
const chatId = "11111111-1111-4111-8111-111111111111";
const messageId = "22222222-2222-4222-8222-222222222222";
const accountId = "33333333-3333-4333-8333-333333333333";
const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network forbidden");
    }),
  );
  mock.keyAccount.mockResolvedValue(accountId);
  mock.chats.mockResolvedValue([{ id: chatId, session_id: chatId, active_stream_id: null }]);
  mock.sessions.mockResolvedValue([{ id: chatId, account_id: accountId }]);
  mock.messages.mockResolvedValue([{ id: messageId, created_at: "2026-10-25T12:00:00.123456Z" }]);
  mock.remove.mockResolvedValue(true);
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it.each([200, 400, 401, 403, 404, 409, 500])(
  "matches published trailing DELETE %s against the canonical route",
  async status => {
    if (status === 403) mock.sessions.mockResolvedValue([{ id: chatId, account_id: "other" }]);
    if (status === 404) mock.messages.mockResolvedValue([]);
    if (status === 409)
      mock.chats.mockResolvedValue([
        { id: chatId, session_id: chatId, active_stream_id: "pending-synthetic" },
      ]);
    if (status === 500) mock.messages.mockResolvedValue(null);
    const response = await DELETE(
      new NextRequest(
        `https://fixture.invalid/api/chats/${chatId}/messages/trailing?from_message_id=${status === 400 ? "bad" : messageId}`,
        {
          method: "DELETE",
          headers: status === 401 ? {} : { "x-api-key": "synthetic" },
        },
      ),
      { params: Promise.resolve({ id: chatId }) },
    );
    expect(response.status).toBe(status);
    const contract = fixture.responseSchemas.find(
      r =>
        r.method === "DELETE" && r.path === fixture.chatTrailingDelete.path && r.status === status,
    );
    expect(contract).toBeDefined();
    const validate = ajv.compile(contract!.schema);
    const body = await response.json();
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    if (status === 200) expect(contract).toHaveProperty("examples.statementSuccess", body);
    if (status === 409) expect(contract).toHaveProperty("examples.occupiedSlot", body);
    expect(mock.remove).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  },
);
