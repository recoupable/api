import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";
import { GET } from "@/app/api/sessions/[sessionId]/chats/[chatId]/route";

const mocks = vi.hoisted(() => ({ from: vi.fn(), validate: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: mocks.from } }));
vi.mock("@/lib/sessions/chats/validateGetSessionChatRequest", () => ({
  validateGetSessionChatRequest: mocks.validate,
}));
vi.mock("@/lib/sessions/chats/patchSessionChatHandler", () => ({
  patchSessionChatHandler: vi.fn(() => {
    throw new Error("Unexpected write");
  }),
}));
vi.mock("@/lib/sessions/chats/deleteSessionChatHandler", () => ({
  deleteSessionChatHandler: vi.fn(() => {
    throw new Error("Unexpected deletion");
  }),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const sessionId = "11111111-1111-4111-8111-111111111111";
const chatId = "22222222-2222-4222-8222-222222222222";
const request = () =>
  GET(new NextRequest(`http://fixture.invalid/api/sessions/${sessionId}/chats/${chatId}`), {
    params: Promise.resolve({ sessionId, chatId }),
  });
function mockRead(data: unknown[] | null, error: { message: string } | null = null) {
  const query = { eq: vi.fn(), order: vi.fn() };
  query.eq.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data, error });
  mocks.from.mockReturnValue({ select: vi.fn(() => query) });
  return query;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("NETWORK FORBIDDEN");
    }),
  );
  mocks.from.mockImplementation(() => {
    throw new Error("Unexpected storage access");
  });
  mocks.validate.mockResolvedValue(baseChatRow({ id: chatId, session_id: sessionId }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("returns typed 500 for a database read failure, without fake history or internal details", async () => {
  mockRead(null, { message: "private database failure detail" });
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ status: "error", error: "Failed to load messages" });
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
});
it("preserves a genuinely empty successful history", async () => {
  const query = mockRead([]);
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    chat: { id: chatId, sessionId },
    messages: [],
    isStreaming: false,
  });
  expect(mocks.from).toHaveBeenCalledWith("chat_messages");
  expect(query.eq).toHaveBeenCalledWith("chat_id", chatId);
  expect(query.order.mock.calls).toEqual([
    ["created_at", { ascending: true }],
    ["id", { ascending: true }],
  ]);
});
it("preserves the saved UIMessage and streaming state", async () => {
  const message = {
    id: "synthetic-message",
    role: "assistant",
    parts: [{ type: "text", text: "Saved answer" }],
  };
  mocks.validate.mockResolvedValue(
    baseChatRow({ id: chatId, session_id: sessionId, active_stream_id: "synthetic-run" }),
  );
  mockRead([{ parts: message }]);
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ messages: [message], isStreaming: true });
});
it.each([401, 403, 404, 500])("preserves validation %s without reading messages", async status => {
  const failure = NextResponse.json({ error: "Validation failure" }, { status });
  mocks.validate.mockResolvedValue(failure);
  expect(await request()).toBe(failure);
  expect(mocks.from).not.toHaveBeenCalled();
});
