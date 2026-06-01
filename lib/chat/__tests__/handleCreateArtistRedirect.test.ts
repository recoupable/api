import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { copyRoom } from "@/lib/rooms/copyRoom";
import { copyChatMessages } from "@/lib/chats/copyChatMessages";
import { handleCreateArtistRedirect } from "../handleCreateArtistRedirect";

vi.mock("@/lib/rooms/copyRoom", () => ({
  copyRoom: vi.fn(),
}));

vi.mock("@/lib/chats/copyChatMessages", () => ({
  copyChatMessages: vi.fn(),
}));

const mockCopyRoom = vi.mocked(copyRoom);
const mockCopyChatMessages = vi.mocked(copyChatMessages);

describe("handleCreateArtistRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns redirect path after creating and copying the final artist room", async () => {
    mockCopyRoom.mockResolvedValue("new-room-123");
    mockCopyChatMessages.mockResolvedValue({
      status: "success",
      copiedCount: 1,
      clearedExisting: true,
    });

    const responseMessages: UIMessage[] = [
      {
        id: "resp-1",
        role: "assistant",
        parts: [
          {
            type: "tool-create_new_artist",
            toolCallId: "tool-1",
            state: "output-available",
            input: {},
            output: {
              artist: {
                account_id: "artist-123",
                name: "Test Artist",
              },
              artistAccountId: "artist-123",
              message: "ok",
            },
          } as any,
        ],
        createdAt: new Date(),
      },
    ];

    const result = await handleCreateArtistRedirect(
      {
        accountId: "account-123",
        messages: [],
        roomId: "room-456",
      } as any,
      responseMessages,
    );

    expect(mockCopyRoom).toHaveBeenCalledWith("room-456", "artist-123");
    expect(mockCopyChatMessages).toHaveBeenCalledWith({
      sourceChatId: "room-456",
      targetChatId: "new-room-123",
      clearExisting: true,
    });
    expect(result).toBe("/chat/new-room-123");
  });

  it("returns undefined when no create artist result exists", async () => {
    const result = await handleCreateArtistRedirect(
      {
        accountId: "account-123",
        messages: [],
        roomId: "room-456",
      } as any,
      [{ id: "resp-1", role: "assistant", parts: [], createdAt: new Date() }],
    );

    expect(result).toBeUndefined();
    expect(mockCopyRoom).not.toHaveBeenCalled();
  });
});
