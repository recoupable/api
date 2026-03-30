import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateChatAccess } from "../validateChatAccess";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/chats/buildGetChatsParams", () => ({
  buildGetChatsParams: vi.fn(),
}));

describe("validateChatAccess", () => {
  const roomId = "123e4567-e89b-12d3-a456-426614174000";
  const accountId = "123e4567-e89b-12d3-a456-426614174001";
  const request = new NextRequest("http://localhost/api/chats", {
    headers: { "x-api-key": "test-key" },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns roomId when account has access", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: accountId,
      artist_id: null,
      topic: "Topic",
      updated_at: "2026-03-30T00:00:00Z",
    });
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: { account_ids: [accountId] },
      error: null,
    });

    const result = await validateChatAccess(request, roomId);
    expect(result).toEqual({ roomId });
  });

  it("returns auth response when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateChatAccess(request, roomId);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("returns 404 when room does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(selectRoom).mockResolvedValue(null);

    const result = await validateChatAccess(request, roomId);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(404);
  });

  it("returns 403 when room belongs to a different account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: "another-account",
      artist_id: null,
      topic: "Topic",
      updated_at: "2026-03-30T00:00:00Z",
    });
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: { account_ids: [accountId] },
      error: null,
    });

    const result = await validateChatAccess(request, roomId);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("allows admin access when account_ids is undefined", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: "admin-org",
      authToken: "admin-key",
    });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: "another-account",
      artist_id: null,
      topic: "Topic",
      updated_at: "2026-03-30T00:00:00Z",
    });
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: {},
      error: null,
    });

    const result = await validateChatAccess(request, roomId);
    expect(result).toEqual({ roomId });
  });
});
