import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/chats/validatePatchSessionChatRequest", () => ({
  validatePatchSessionChatRequest: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/updateChat", () => ({
  updateChat: vi.fn(),
}));

const { validatePatchSessionChatRequest } = await import(
  "@/lib/sessions/chats/validatePatchSessionChatRequest"
);
const { updateChat } = await import("@/lib/supabase/chats/updateChat");
const { patchSessionChatHandler } = await import("@/lib/sessions/chats/patchSessionChatHandler");

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1", {
    method: "PATCH",
  });
}

function mockValidated(patch: { title?: string; modelId?: string }) {
  vi.mocked(validatePatchSessionChatRequest).mockResolvedValue({
    auth: { accountId, orgId: null, authToken: "tok" },
    session: baseSessionRow({ id: "sess_1", account_id: accountId }),
    chat: baseChatRow({ id: "chat_1", session_id: "sess_1" }),
    patch,
  });
}

describe("patchSessionChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the NextResponse from the validator as-is", async () => {
    const failure = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(validatePatchSessionChatRequest).mockResolvedValue(failure);

    const res = await patchSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res).toBe(failure);
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("maps modelId to model_id and stores title verbatim", async () => {
    mockValidated({ title: "Renamed", modelId: "openai/gpt-5-mini" });
    vi.mocked(updateChat).mockResolvedValue(
      baseChatRow({
        id: "chat_1",
        title: "Renamed",
        model_id: "openai/gpt-5-mini",
      }),
    );

    const res = await patchSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(200);
    expect(updateChat).toHaveBeenCalledWith({
      chatId: "chat_1",
      patch: { title: "Renamed", model_id: "openai/gpt-5-mini" },
    });
    const body = (await res.json()) as { chat: { title: string; model_id: string } };
    expect(body.chat.title).toBe("Renamed");
    expect(body.chat.model_id).toBe("openai/gpt-5-mini");
  });

  it("only patches the field provided", async () => {
    mockValidated({ title: "Just a title" });
    vi.mocked(updateChat).mockResolvedValue(baseChatRow({ id: "chat_1", title: "Just a title" }));

    await patchSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(updateChat).toHaveBeenCalledWith({
      chatId: "chat_1",
      patch: { title: "Just a title" },
    });
  });

  it("returns 500 when updateChat returns null", async () => {
    mockValidated({ title: "Renamed" });
    vi.mocked(updateChat).mockResolvedValue(null);

    const res = await patchSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(500);
  });
});
