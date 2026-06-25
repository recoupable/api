import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateStopChatWorkflowRequest } from "@/lib/chat/validateStopChatWorkflowRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const CHAT_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/chat/" + CHAT_ID + "/stop", {
    method: "POST",
    headers: { "x-api-key": "test-key" },
  });
}

describe("validateStopChatWorkflowRequest auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through the auth NextResponse on authentication failure", async () => {
    const unauthorized = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

    const result = await validateStopChatWorkflowRequest(makeRequest(), CHAT_ID);

    expect(result).toBe(unauthorized);
  });

  it("returns 400 when chatId is not a valid UUID", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      orgId: null,
      authToken: "token",
    });

    const result = await validateStopChatWorkflowRequest(makeRequest(), "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
