import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/chats/validateGetSessionChatsRequest", () => ({
  validateGetSessionChatsRequest: vi.fn(),
}));
vi.mock("@/lib/sessions/chats/getChatSummaries", () => ({
  getChatSummaries: vi.fn(),
}));

const { validateGetSessionChatsRequest } = await import(
  "@/lib/sessions/chats/validateGetSessionChatsRequest"
);
const { getChatSummaries } = await import("@/lib/sessions/chats/getChatSummaries");
const { getSessionChatsHandler } = await import("@/lib/sessions/chats/getSessionChatsHandler");

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats");
}

function mockValidated() {
  vi.mocked(validateGetSessionChatsRequest).mockResolvedValue({
    auth: { accountId, orgId: null, authToken: "tok" },
    session: baseSessionRow({ id: "sess_1", account_id: accountId }),
  });
}

describe("getSessionChatsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the NextResponse from validateGetSessionChatsRequest as-is", async () => {
    const failure = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(validateGetSessionChatsRequest).mockResolvedValue(failure);

    const res = await getSessionChatsHandler(makeReq(), "sess_1");
    expect(res).toBe(failure);
    expect(getChatSummaries).not.toHaveBeenCalled();
  });

  it("returns 200 with summaries from the db and DEFAULT_MODEL", async () => {
    mockValidated();
    const summaries = [
      {
        id: "chat_1",
        sessionId: "sess_1",
        title: "First",
        modelId: null,
        activeStreamId: null,
        lastAssistantMessageAt: null,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        hasUnread: false,
        isStreaming: false,
      },
    ];
    vi.mocked(getChatSummaries).mockResolvedValue(summaries);

    const res = await getSessionChatsHandler(makeReq(), "sess_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      chats: typeof summaries;
      defaultModelId: string;
    };
    expect(body.chats).toEqual(summaries);
    expect(body.defaultModelId).toBe("openai/gpt-5.4-mini");
    expect(getChatSummaries).toHaveBeenCalledWith({
      sessionId: "sess_1",
      accountId,
    });
  });
});
