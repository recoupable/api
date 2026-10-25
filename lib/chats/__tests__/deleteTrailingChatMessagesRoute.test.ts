import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { DELETE } from "@/app/api/chats/[id]/messages/trailing/route";

const mock = vi.hoisted(() => ({ auth: vi.fn(), database: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: mock.auth }));
vi.mock("@/lib/supabase/serverClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient("https://database.fixture.invalid", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: mock.database },
    }),
  };
});
const chatId = "11111111-1111-4111-8111-111111111111";
const messageId = "22222222-2222-4222-8222-222222222222";
const otherChatId = "33333333-3333-4333-8333-333333333333";
const owner = "44444444-4444-4444-8444-444444444444";
const timestamp = "2026-10-25T12:00:00.123456+00:00";
let slot: string | null;
let sessionOwner: string;
let anchor: Record<string, unknown> | null;
let failedTable: string | undefined;
let missingTable: string | undefined;
let deleteFails: boolean;
let requests: { url: URL; method: string }[];
const invoke = (query = `from_message_id=${messageId}`, id = chatId) =>
  DELETE(
    new NextRequest(`https://api.fixture.invalid/api/chats/${id}/messages/trailing?${query}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) },
  );
const mutations = () => requests.filter(r => r.method !== "GET");
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("EXTERNAL NETWORK FORBIDDEN");
    }),
  );
  slot = null;
  sessionOwner = owner;
  failedTable = undefined;
  missingTable = undefined;
  deleteFails = false;
  requests = [];
  anchor = { id: messageId, chat_id: chatId, created_at: timestamp, role: "assistant", parts: {} };
  mock.auth.mockResolvedValue({ accountId: owner, orgId: null });
  mock.database.mockImplementation(async (input: string | URL, init: RequestInit) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://database.fixture.invalid");
    const table = url.pathname.split("/").at(-1)!;
    const method = init.method ?? "GET";
    requests.push({ url, method });
    if (method === "DELETE") {
      expect(table).toBe("chat_messages");
      return deleteFails
        ? new Response(JSON.stringify({ message: "fixture delete error" }), { status: 500 })
        : new Response(null, { status: 204 });
    }
    expect(method).toBe("GET"); // No slot writes, CAS, cancellation or reconciliation.
    expect(["chats", "sessions", "chat_messages"]).toContain(table); // No legacy storage.
    if (table === failedTable)
      return new Response(JSON.stringify({ message: "fixture read error" }), { status: 500 });
    let rows: Record<string, unknown>[] =
      table === "chats"
        ? [{ id: chatId, session_id: otherChatId, active_stream_id: slot }]
        : table === "sessions"
          ? [{ id: otherChatId, account_id: sessionOwner }]
          : anchor
            ? [anchor]
            : [];
    if (table === missingTable) rows = [];
    for (const [key, value] of url.searchParams)
      if (value.startsWith("eq.")) rows = rows.filter(row => row[key] === value.slice(3));
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it("uses the actual route, ownership, readers and PostgREST builder for one scoped inclusive delete", async () => {
  const response = await invoke();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: "success",
    chat_id: chatId,
    from_message_id: messageId,
  });
  const reads = requests.filter(
    r => r.url.pathname.endsWith("/chat_messages") && r.method === "GET",
  );
  expect(reads).toHaveLength(1);
  expect(reads[0].url.searchParams.get("chat_id")).toBe(`eq.${chatId}`);
  expect(reads[0].url.searchParams.get("id")).toBe(`eq.${messageId}`);
  expect(mutations()).toHaveLength(1);
  expect(mutations()[0].url.searchParams.get("chat_id")).toBe(`eq.${chatId}`);
  expect(mutations()[0].url.searchParams.get("or")).toBe(
    `(created_at.gt."${timestamp}",and(created_at.eq."${timestamp}",id.gte.${messageId}))`,
  );
});
it("honors an approved account override through the current ownership validator", async () => {
  sessionOwner = otherChatId;
  mock.auth.mockResolvedValue({ accountId: otherChatId, orgId: "fixture-org" });
  expect((await invoke(`from_message_id=${messageId}&account_id=${otherChatId}`)).status).toBe(200);
  expect(mock.auth).toHaveBeenCalledWith(expect.anything(), { accountId: otherChatId });
});
it.each([401, 403, 500])(
  "passes authentication %s through without storage access",
  async status => {
    const failure = NextResponse.json({ error: "denied" }, { status });
    mock.auth.mockResolvedValue(failure);
    expect(await invoke()).toBe(failure);
    expect(requests).toHaveLength(0);
  },
);
it("denies a different effective owner without reading or mutating messages", async () => {
  sessionOwner = otherChatId;
  expect((await invoke()).status).toBe(403);
  expect(requests.map(r => r.url.pathname.split("/").at(-1))).toEqual(["chats", "sessions"]);
  expect(mutations()).toHaveLength(0);
});
it.each(["chats", "sessions", "chat_messages"])("fails closed on %s read error", async table => {
  failedTable = table;
  expect((await invoke()).status).toBe(500);
  expect(mutations()).toHaveLength(0);
});
it.each(["chats", "sessions", "chat_messages"])("returns 404 for absent %s", async table => {
  missingTable = table;
  expect((await invoke()).status).toBe(404);
  expect(mutations()).toHaveLength(0);
});
it("does not find an anchor in a foreign chat", async () => {
  anchor!.chat_id = otherChatId;
  expect((await invoke()).status).toBe(404);
  expect(mutations()).toHaveLength(0);
});
it.each(["pending:fixture", "stale-fixture", "run-fixture", ""])(
  "rejects any observed occupied slot %s before anchor reads",
  async occupied => {
    slot = occupied;
    expect((await invoke()).status).toBe(409);
    expect(requests).toHaveLength(2);
    expect(mutations()).toHaveLength(0);
  },
);
it.each(["", "from_message_id=bad"])(
  "keeps invalid query 400 before slot rejection: %s",
  async query => {
    slot = "pending:fixture";
    const response = await invoke(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      status: "error",
      missing_fields: ["from_message_id"],
    });
    expect(mutations()).toHaveLength(0);
  },
);
it("rejects an invalid chat ID before storage", async () => {
  expect((await invoke(undefined, "bad")).status).toBe(400);
  expect(requests).toHaveLength(0);
});
it.each(["invalid", "2026-02-30T00:00:00Z", "infinity"])(
  "rejects malformed stored timestamp %s before mutation",
  async value => {
    anchor!.created_at = value;
    expect((await invoke()).status).toBe(500);
    expect(mutations()).toHaveLength(0);
  },
);
it("returns 500 on delete failure", async () => {
  deleteFails = true;
  expect((await invoke()).status).toBe(500);
  expect(mutations()).toHaveLength(1);
});
it("reports statement success even when the database returns no affected-row count", async () => {
  expect((await invoke()).status).toBe(200);
  expect(mutations()).toHaveLength(1);
});
