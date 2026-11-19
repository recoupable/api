import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";
import type { Tables } from "@/types/database.types";
import * as disclosure from "@/lib/sessions/chats/retained-field/readRetainedFieldDisclosure";
import { GET } from "@/app/api/sessions/[sessionId]/chats/[chatId]/route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sessions: vi.fn(),
  chats: vi.fn(),
  messages: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: mocks.auth }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: mocks.sessions }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: mocks.chats }));
vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: mocks.messages,
}));
vi.mock("@/lib/sessions/chats/patchSessionChatHandler", () => ({
  patchSessionChatHandler: vi.fn(),
}));
vi.mock("@/lib/sessions/chats/deleteSessionChatHandler", () => ({
  deleteSessionChatHandler: vi.fn(),
}));

const companion = {
  type: "data-retained-field-snapshot",
  capability: "retained-field-companion/1",
  data: {
    fieldContext: {
      contract: "catalog-retained-field-projection/1",
      items: [{ value: { amount: 987654321 } }],
    },
    surface: { schemaVersion: 1, fallbackText: "PRIVATE DERIVED 987654321" },
  },
};
const legacy = {
  id: "legacy",
  role: "assistant",
  parts: [
    {
      type: "data-catalog-snapshot",
      data: { schemaVersion: 1, title: "Legacy report", controls: { sort: "streams" } },
    },
    { type: "text", text: "Legacy answer" },
  ],
};
function row(parts: unknown, id = "retained"): Tables<"chat_messages"> {
  return {
    id,
    chat_id: "chat_1",
    role: "assistant",
    parts: parts as Tables<"chat_messages">["parts"],
    created_at: "2026-11-19T00:00:00Z",
  };
}
function request() {
  return GET(new NextRequest("https://fixture.invalid/api/sessions/sess_1/chats/chat_1"), {
    params: Promise.resolve({ sessionId: "sess_1", chatId: "chat_1" }),
  });
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("NETWORK FORBIDDEN");
    }),
  );
  mocks.auth.mockResolvedValue({ accountId: "actual-actor", orgId: null, authToken: "synthetic" });
  mocks.sessions.mockResolvedValue([baseSessionRow({ account_id: "actual-actor" })]);
  mocks.chats.mockResolvedValue([baseChatRow()]);
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it("withholds whole retained messages including sibling text, numeric tables and metadata, preserving legacy order", async () => {
  const retained = {
    id: "retained",
    role: "assistant",
    metadata: { summary: "PRIVATE DERIVED 987654321" },
    parts: [
      { type: "text", text: "PRIVATE DERIVED 987654321" },
      companion,
      { type: "data-table", data: { rows: [[987654321]] } },
    ],
  };
  mocks.messages.mockResolvedValue([
    row(legacy, "legacy"),
    row(retained),
    row({ ...legacy, id: "after" }, "after"),
  ]);
  const response = await request();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.messages).toEqual([legacy, { ...legacy, id: "after" }]);
  expect(JSON.stringify(body)).not.toContain("987654321");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it.each([
  { ...companion, capability: "unknown-version" },
  { type: "data-retained-field-snapshot", data: null },
  { capability: "retained-field-companion/1", data: {} },
  { data: { fieldContext: { contract: "catalog-retained-field-projection/1" } } },
  { mode: "retained_field" },
])(
  "withholds malformed or unsupported family members without relying on successful schema parsing: %j",
  async part => {
    mocks.messages.mockResolvedValue([
      row({
        id: "retained",
        role: "assistant",
        parts: [{ type: "text", text: "PRIVATE DERIVED" }, part],
      }),
    ]);
    expect((await (await request()).json()).messages).toEqual([]);
  },
);
it("also withholds legacy array-shaped stored parts when they contain the new family", async () => {
  mocks.messages.mockResolvedValue([row([{ type: "text", text: "PRIVATE DERIVED" }, companion])]);
  expect((await (await request()).json()).messages).toEqual([]);
});
it("cached ready, successful preparation and local disclosure flags never permit history disclosure", async () => {
  mocks.messages.mockResolvedValue([
    row({
      id: "retained",
      role: "assistant",
      state: "ready",
      preparation: "ready",
      disclosure: "available",
      parts: [companion],
    }),
  ]);
  expect((await (await request()).json()).messages).toEqual([]);
});
it("preserves legacy text even when it mentions retained fields", async () => {
  const message = {
    id: "normal",
    role: "assistant",
    parts: [{ type: "text", text: "Explain data-retained-field-snapshot" }],
  };
  mocks.messages.mockResolvedValue([row(message)]);
  expect((await (await request()).json()).messages).toEqual([message]);
});
it("does not read history for a different authenticated actor", async () => {
  mocks.auth.mockResolvedValue({ accountId: "wrong-actor", orgId: null, authToken: "synthetic" });
  expect((await request()).status).toBe(403);
  expect(mocks.messages).not.toHaveBeenCalled();
});

it.each(["unavailable", "withdrawn", "stale", "error", "ready"])(
  "denies the whole message for injected current-boundary result %s (including unsupported states)",
  async state => {
    const stored = {
      id: "spoofed-message",
      accountId: "forged-owner",
      sessionId: "other-session",
      chatId: "other-chat",
      role: "assistant",
      parts: [companion, { type: "text", text: "PRIVATE DERIVED" }],
    };
    const read = vi
      .spyOn(disclosure, "readRetainedFieldDisclosure")
      .mockResolvedValue({ state } as never);
    mocks.messages.mockResolvedValue([row(stored, "database-message-id")]);
    const body = await (await request()).json();
    expect(body.messages).toEqual([]);
    expect(read).toHaveBeenCalledExactlyOnceWith(
      {
        actorAccountId: "actual-actor",
        sessionId: "sess_1",
        chatId: "chat_1",
        messageId: "database-message-id",
      },
      stored,
    );
    expect(JSON.stringify(body)).not.toContain("forged-owner");
  },
);
it("withholds every projection on a thrown current-source error without retry or diagnostics", async () => {
  const read = vi
    .spyOn(disclosure, "readRetainedFieldDisclosure")
    .mockRejectedValue(new Error("PRIVATE AUTHORITY ERROR"));
  mocks.messages.mockResolvedValue([
    row({ id: "retained", parts: [companion, { type: "text", text: "PRIVATE DERIVED" }] }),
    row(legacy, "legacy"),
  ]);
  const response = await request();
  expect((await response.json()).messages).toEqual([legacy]);
  expect(read).toHaveBeenCalledTimes(1);
});
it("does not invoke current-field authority for legacy reports or text", async () => {
  const read = vi.spyOn(disclosure, "readRetainedFieldDisclosure");
  mocks.messages.mockResolvedValue([row(legacy)]);
  expect((await (await request()).json()).messages).toEqual([legacy]);
  expect(read).not.toHaveBeenCalled();
});
