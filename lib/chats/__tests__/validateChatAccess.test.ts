import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateChatAccess } from "../validateChatAccess";
import { resolveAccessibleRoom } from "../resolveAccessibleRoom";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../resolveAccessibleRoom", () => ({
  resolveAccessibleRoom: vi.fn(),
}));

describe("validateChatAccess", () => {
  const roomId = "123e4567-e89b-12d3-a456-426614174000";
  const request = new NextRequest("http://localhost/api/chats", {
    headers: { "x-api-key": "test-key" },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns roomId when account has access", async () => {
    vi.mocked(resolveAccessibleRoom).mockResolvedValue({
      id: roomId,
      accountId: "123e4567-e89b-12d3-a456-426614174001",
      room: {
        id: roomId,
        account_id: "123e4567-e89b-12d3-a456-426614174001",
        artist_id: null,
        topic: "Topic",
        updated_at: "2026-03-30T00:00:00Z",
      },
    });

    const result = await validateChatAccess(request, roomId);
    expect(result).toEqual({ roomId });
  });

  it("returns resolver response when access resolution fails", async () => {
    vi.mocked(resolveAccessibleRoom).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateChatAccess(request, roomId);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("returns resolver 404 response unchanged", async () => {
    vi.mocked(resolveAccessibleRoom).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Chat room not found" }, { status: 404 }),
    );
    const result = await validateChatAccess(request, roomId);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(404);
  });
});
