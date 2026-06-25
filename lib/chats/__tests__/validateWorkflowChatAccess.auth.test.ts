import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateWorkflowChatAccess } from "@/lib/chats/validateWorkflowChatAccess";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));

const chatId = "123e4567-e89b-42d3-a456-426614174000";
const request = new NextRequest(`http://localhost/api/chats/${chatId}/messages/trailing`);

describe("validateWorkflowChatAccess auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid chat id", async () => {
    const result = await validateWorkflowChatAccess(request, "not-a-uuid");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("passes through auth errors", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateWorkflowChatAccess(request, chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});
