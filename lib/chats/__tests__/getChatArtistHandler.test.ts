import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getChatArtistHandler } from "@/lib/chats/getChatArtistHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import selectRoom from "@/lib/supabase/rooms/selectRoom";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

const createRequest = () => new NextRequest("http://localhost/api/chats/chat-id/artist");

describe("getChatArtistHandler", () => {
  const accountId = "11111111-1111-1111-1111-111111111111";
  const roomId = "123e4567-e89b-42d3-a456-426614174000";
  const artistId = "123e4567-e89b-42d3-a456-426614174001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid chat id", async () => {
    const response = await getChatArtistHandler(createRequest(), "invalid-id");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      status: "error",
      error: "id must be a valid UUID",
    });
  });

  it("returns auth error response when auth validation fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const response = await getChatArtistHandler(createRequest(), roomId);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      status: "error",
      error: "Unauthorized",
    });
  });

  it("returns 404 when room does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null });
    vi.mocked(selectRoom).mockResolvedValue(null);

    const response = await getChatArtistHandler(createRequest(), roomId);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      status: "error",
      error: "Chat room not found",
    });
  });

  it("returns 404 when user has no access to another account's room", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: "123e4567-e89b-42d3-a456-426614174002",
      artist_id: artistId,
      topic: "Test",
      updated_at: null,
    });
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const response = await getChatArtistHandler(createRequest(), roomId);
    const body = await response.json();

    expect(canAccessAccount).toHaveBeenCalledWith({
      currentAccountId: accountId,
      targetAccountId: "123e4567-e89b-42d3-a456-426614174002",
    });
    expect(response.status).toBe(404);
    expect(body).toEqual({
      status: "error",
      error: "Chat room not found",
    });
  });

  it("returns chat artist for room owner", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: accountId,
      artist_id: artistId,
      topic: "Test",
      updated_at: null,
    });

    const response = await getChatArtistHandler(createRequest(), roomId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      room_id: roomId,
      artist_id: artistId,
      artist_exists: true,
    });
  });

  it("returns null artist fields when chat has no artist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: accountId,
      artist_id: null,
      topic: "Test",
      updated_at: null,
    });

    const response = await getChatArtistHandler(createRequest(), roomId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      room_id: roomId,
      artist_id: null,
      artist_exists: false,
    });
  });
});
