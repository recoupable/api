import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getChatSegmentHandler } from "@/lib/chats/getChatSegmentHandler";
import { resolveAccessibleRoom } from "@/lib/chats/resolveAccessibleRoom";
import { selectSegmentRoomByRoomId } from "@/lib/supabase/segment_rooms/selectSegmentRoomByRoomId";

vi.mock("@/lib/chats/resolveAccessibleRoom", () => ({
  resolveAccessibleRoom: vi.fn(),
}));

vi.mock("@/lib/supabase/segment_rooms/selectSegmentRoomByRoomId", () => ({
  selectSegmentRoomByRoomId: vi.fn(),
}));

const createRequest = () => new NextRequest("http://localhost/api/chats/chat-id/segment");

describe("getChatSegmentHandler", () => {
  const roomId = "123e4567-e89b-42d3-a456-426614174000";
  const segmentId = "123e4567-e89b-42d3-a456-426614174003";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation/auth response from resolver", async () => {
    vi.mocked(resolveAccessibleRoom).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const response = await getChatSegmentHandler(createRequest(), roomId);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      status: "error",
      error: "Unauthorized",
    });
    expect(selectSegmentRoomByRoomId).not.toHaveBeenCalled();
  });

  it("returns linked segment when segment_room exists", async () => {
    vi.mocked(resolveAccessibleRoom).mockResolvedValue({
      room: {
        id: roomId,
        account_id: "11111111-1111-1111-1111-111111111111",
        artist_id: null,
        topic: "Test",
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(selectSegmentRoomByRoomId).mockResolvedValue({
      room_id: roomId,
      segment_id: segmentId,
      id: "123e4567-e89b-42d3-a456-426614174004",
      created_at: null,
      updated_at: null,
    });

    const response = await getChatSegmentHandler(createRequest(), roomId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      room_id: roomId,
      segment_id: segmentId,
      segment_exists: true,
    });
  });

  it("returns null segment when no segment_room exists", async () => {
    vi.mocked(resolveAccessibleRoom).mockResolvedValue({
      room: {
        id: roomId,
        account_id: "11111111-1111-1111-1111-111111111111",
        artist_id: null,
        topic: "Test",
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(selectSegmentRoomByRoomId).mockResolvedValue(null);

    const response = await getChatSegmentHandler(createRequest(), roomId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      room_id: roomId,
      segment_id: null,
      segment_exists: false,
    });
  });
});
