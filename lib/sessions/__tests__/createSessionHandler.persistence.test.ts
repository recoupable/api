import { describe, it, expect, vi, beforeEach } from "vitest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { deleteSessionById } from "@/lib/supabase/sessions/deleteSessionById";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { createSessionHandler } from "@/lib/sessions/createSessionHandler";
import {
  baseChatRow,
  baseSessionRow,
  makeCreateSessionReq,
  okAuth,
} from "@/lib/sessions/__tests__/createSessionHandlerFixtures";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/sessions/insertSession", () => ({ insertSession: vi.fn() }));
vi.mock("@/lib/supabase/sessions/deleteSessionById", () => ({ deleteSessionById: vi.fn() }));
vi.mock("@/lib/supabase/chats/insertChat", () => ({ insertChat: vi.fn() }));

describe("createSessionHandler — persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates session and chat with defaults on empty body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(baseSessionRow());
    vi.mocked(insertChat).mockResolvedValue(baseChatRow());

    const res = await createSessionHandler(makeCreateSessionReq({}));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { session: { userId: string }; chat: { sessionId: string } };
    expect(body.session.userId).toBe("acc-uuid-1");
    expect(body.chat.sessionId).toBe("sess_1");

    const insertArgs = vi.mocked(insertSession).mock.calls[0][0];
    expect(insertArgs.account_id).toBe("acc-uuid-1");
    expect(insertArgs.status).toBe("running");
    expect(insertArgs.lifecycle_state).toBe("provisioning");
    expect(insertArgs.sandbox_state).toEqual({ type: "vercel" });

    const chatArgs = vi.mocked(insertChat).mock.calls[0][0];
    expect(chatArgs.session_id).toBe("sess_1");
    expect(chatArgs.title).toBe("New chat");
  });

  it("uses provided title when present", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(baseSessionRow({ title: "Hello world" }));
    vi.mocked(insertChat).mockResolvedValue(baseChatRow());

    await createSessionHandler(makeCreateSessionReq({ title: "Hello world" }));
    expect(vi.mocked(insertSession).mock.calls[0][0].title).toBe("Hello world");
  });

  it("returns 500 when insertSession fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(null);

    const res = await createSessionHandler(makeCreateSessionReq({}));
    expect(res.status).toBe(500);
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("rolls back the session and returns 500 when insertChat fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
    vi.mocked(insertSession).mockResolvedValue(baseSessionRow({ id: "sess_rollback" }));
    vi.mocked(insertChat).mockResolvedValue(null);

    const res = await createSessionHandler(makeCreateSessionReq({}));
    expect(res.status).toBe(500);
    expect(deleteSessionById).toHaveBeenCalledWith("sess_rollback");
  });
});
