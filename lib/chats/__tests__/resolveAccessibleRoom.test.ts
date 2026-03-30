import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { resolveAccessibleRoom } from "@/lib/chats/resolveAccessibleRoom";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/chats/buildGetChatsParams", () => ({
  buildGetChatsParams: vi.fn(),
}));

const createRequest = () => new NextRequest("http://localhost/api/chats/chat-id/segment");

describe("resolveAccessibleRoom", () => {
  const accountId = "11111111-1111-1111-1111-111111111111";
  const roomId = "123e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid chat id", async () => {
    const result = await resolveAccessibleRoom(createRequest(), "invalid-id");
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
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

    const result = await resolveAccessibleRoom(createRequest(), roomId);
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("returns 404 when room does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null });
    vi.mocked(selectRoom).mockResolvedValue(null);

    const result = await resolveAccessibleRoom(createRequest(), roomId);
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
    expect(response.status).toBe(404);
  });

  it("returns 403 when user has no access to room owner account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: "123e4567-e89b-42d3-a456-426614174002",
      artist_id: null,
      topic: "Test",
      updated_at: null,
    });
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: { account_ids: [accountId] },
      error: null,
    });

    const result = await resolveAccessibleRoom(createRequest(), roomId);
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
    expect(response.status).toBe(403);
  });

  it("returns room when requester is the room owner", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null });
    vi.mocked(selectRoom).mockResolvedValue({
      id: roomId,
      account_id: accountId,
      artist_id: null,
      topic: "Test",
      updated_at: null,
    });
    vi.mocked(buildGetChatsParams).mockResolvedValue({
      params: { account_ids: [accountId] },
      error: null,
    });

    const result = await resolveAccessibleRoom(createRequest(), roomId);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      room: {
        id: roomId,
        account_id: accountId,
        artist_id: null,
        topic: "Test",
        updated_at: null,
      },
      accountId,
    });
  });
});
