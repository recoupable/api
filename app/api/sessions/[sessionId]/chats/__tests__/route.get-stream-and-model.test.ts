import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { baseChat, makeChatsListReq, mockSession } from "./chatsRouteTestFixtures";

vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));

vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

vi.mock("@/lib/supabase/chat_reads/selectChatReadsByAccountAndChatIds", () => ({
  selectChatReadsByAccountAndChatIds: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { selectChatReadsByAccountAndChatIds } = await import(
  "@/lib/supabase/chat_reads/selectChatReadsByAccountAndChatIds"
);
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");

const authed = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: "acc-uuid-1",
    orgId: null,
    authToken: "tok",
  });

describe("GET /api/sessions/[sessionId]/chats — stream and model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isStreaming true when activeStreamId is set", async () => {
    authed();
    vi.mocked(selectSessions).mockResolvedValue([mockSession]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChat({ id: "c1", active_stream_id: "stream_xyz" }),
    ]);
    vi.mocked(selectChatReadsByAccountAndChatIds).mockResolvedValue([]);

    const res = await GET(makeChatsListReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    const body = await res.json();
    expect(body.chats[0].isStreaming).toBe(true);
  });

  it("coalesces null model_id to defaultModel string", async () => {
    authed();
    vi.mocked(selectSessions).mockResolvedValue([mockSession]);
    vi.mocked(selectChats).mockResolvedValue([baseChat({ id: "c1", model_id: null })]);
    vi.mocked(selectChatReadsByAccountAndChatIds).mockResolvedValue([]);

    const res = await GET(makeChatsListReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    const body = await res.json();
    expect(body.chats[0].modelId).toBe("openai/gpt-5-mini");
  });
});
