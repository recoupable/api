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

  it("returns 400 when roomId is invalid uuid", async () => {
    const result = await validateChatAccess(request, "invalid-id");
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
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

  it("returns 403 when room belongs to inaccessible account", async () => {
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

  it("returns 403 when buildGetChatsParams returns null params", async () => {
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
      params: null,
      error: "Access denied",
    });

    const result = await validateChatAccess(request, roomId);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("returns 403 when room has null account_id", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: null,
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

  it("returns roomId for accessible room", async () => {
    const room = {
      id: roomId,
      account_id: accountId,
      artist_id: null,
      topic: "Topic",
      updated_at: "2026-03-30T00:00:00Z",
    };

    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(selectRoom).mockResolvedValue(room);
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: { account_ids: [accountId] },
      error: null,
    });

    const result = await validateChatAccess(request, roomId);
    expect(result).toEqual({ roomId, room, accountId });
  });

  it("returns 500 when an unexpected error occurs", async () => {
    vi.mocked(validateAuthContext).mockRejectedValue(new Error("Unexpected auth error"));

    const result = await validateChatAccess(request, roomId);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Failed to validate chat access",
    });
  });
});
