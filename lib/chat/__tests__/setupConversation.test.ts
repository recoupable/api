import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/uuid/generateUUID", () => {
  const mockFn = vi.fn(() => "mock-uuid");
  return {
    generateUUID: mockFn,
    default: mockFn,
  };
});

vi.mock("@/lib/chat/createNewRoom", () => ({
  createNewRoom: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/insertMemories", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/messages/filterMessageContentForMemories", () => ({
  default: vi.fn((msg: unknown) => msg),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

import { generateUUID } from "@/lib/uuid/generateUUID";
import { createNewRoom } from "@/lib/chat/createNewRoom";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { setupConversation } from "../setupConversation";

const mockGenerateUUID = vi.mocked(generateUUID);
const mockCreateNewRoom = vi.mocked(createNewRoom);
const mockInsertMemories = vi.mocked(insertMemories);
const mockFilterMessageContentForMemories = vi.mocked(filterMessageContentForMemories);
const mockSelectRoom = vi.mocked(selectRoom);

/**
 * Helper to create a UIMessage for testing.
 *
 * @param text - The message text
 * @param role - The message role (user or assistant)
 * @returns A UIMessage-like object
 */
function createUIMessage(text: string, role: "user" | "assistant" = "user") {
  return {
    id: "msg-id",
    role,
    parts: [{ type: "text" as const, text }],
  };
}

describe("setupConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateUUID.mockReturnValue("generated-uuid");
    mockCreateNewRoom.mockResolvedValue(undefined);
    mockInsertMemories.mockResolvedValue(null);
    // By default, selectRoom returns an existing room when roomId is provided
    mockSelectRoom.mockResolvedValue({ id: "existing-room-id" } as never);
  });

  describe("room creation", () => {
    it("creates a new room when roomId is not provided", async () => {
      const promptMessage = createUIMessage("Hello");

      await setupConversation({
        accountId: "account-123",
        promptMessage,
      });

      expect(mockCreateNewRoom).toHaveBeenCalledWith({
        accountId: "account-123",
        roomId: "generated-uuid",
        artistId: undefined,
        lastMessage: promptMessage,
      });
    });

    it("does NOT create a room when roomId is provided and room exists", async () => {
      mockSelectRoom.mockResolvedValue({ id: "existing-room-id" } as never);
      const promptMessage = createUIMessage("Hello");

      await setupConversation({
        accountId: "account-123",
        roomId: "existing-room-id",
        promptMessage,
      });

      expect(mockSelectRoom).toHaveBeenCalledWith("existing-room-id");
      expect(mockCreateNewRoom).not.toHaveBeenCalled();
    });

    it("creates a room when roomId is provided but room does NOT exist", async () => {
      mockSelectRoom.mockResolvedValue(null);
      const promptMessage = createUIMessage("Hello");

      await setupConversation({
        accountId: "account-123",
        roomId: "non-existent-room-id",
        promptMessage,
      });

      expect(mockSelectRoom).toHaveBeenCalledWith("non-existent-room-id");
      expect(mockCreateNewRoom).toHaveBeenCalledWith({
        accountId: "account-123",
        roomId: "non-existent-room-id",
        artistId: undefined,
        lastMessage: promptMessage,
      });
    });

    it("passes artistId to createNewRoom when provided", async () => {
      const promptMessage = createUIMessage("Hello");

      await setupConversation({
        accountId: "account-123",
        promptMessage,
        artistId: "artist-xyz",
      });

      expect(mockCreateNewRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          artistId: "artist-xyz",
        }),
      );
    });

    it("passes topic to createNewRoom when provided", async () => {
      const promptMessage = createUIMessage("Hello");

      await setupConversation({
        accountId: "account-123",
        promptMessage,
        topic: "Pulse Feb 2",
      });

      expect(mockCreateNewRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "Pulse Feb 2",
        }),
      );
    });

    it("does NOT pass topic to createNewRoom when room already exists", async () => {
      mockSelectRoom.mockResolvedValue({ id: "existing-room-id" } as never);
      const promptMessage = createUIMessage("Hello");

      await setupConversation({
        accountId: "account-123",
        roomId: "existing-room-id",
        topic: "Should be ignored",
        promptMessage,
      });

      expect(mockCreateNewRoom).not.toHaveBeenCalled();
    });
  });

  describe("message persistence", () => {
    it("persists user message to memories", async () => {
      const promptMessage = createUIMessage("Test message");

      await setupConversation({
        accountId: "account-123",
        promptMessage,
      });

      expect(mockInsertMemories).toHaveBeenCalledWith({
        id: "generated-uuid",
        room_id: "generated-uuid",
        content: promptMessage,
      });
      expect(mockFilterMessageContentForMemories).toHaveBeenCalledWith(promptMessage);
    });

    it("uses provided memoryId instead of generating one", async () => {
      const promptMessage = createUIMessage("Test message");

      await setupConversation({
        accountId: "account-123",
        roomId: "existing-room",
        promptMessage,
        memoryId: "custom-memory-id",
      });

      expect(mockInsertMemories).toHaveBeenCalledWith({
        id: "custom-memory-id",
        room_id: "existing-room",
        content: promptMessage,
      });
    });

    it("persists message for both new and existing rooms", async () => {
      const promptMessage = createUIMessage("Hello");

      // New room
      await setupConversation({
        accountId: "account-123",
        promptMessage,
      });
      expect(mockInsertMemories).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Existing room
      await setupConversation({
        accountId: "account-123",
        roomId: "existing-room",
        promptMessage,
      });
      expect(mockInsertMemories).toHaveBeenCalledTimes(1);
    });
  });

  describe("return values", () => {
    it("returns generated roomId when not provided", async () => {
      mockGenerateUUID.mockReturnValue("new-room-uuid");
      const promptMessage = createUIMessage("Hello");

      const result = await setupConversation({
        accountId: "account-123",
        promptMessage,
      });

      expect(result.roomId).toBe("new-room-uuid");
    });

    it("returns provided roomId when given", async () => {
      const promptMessage = createUIMessage("Hello");

      const result = await setupConversation({
        accountId: "account-123",
        roomId: "provided-room-id",
        promptMessage,
      });

      expect(result.roomId).toBe("provided-room-id");
    });

    it("returns generated memoryId when not provided", async () => {
      mockGenerateUUID.mockReturnValue("new-memory-uuid");
      const promptMessage = createUIMessage("Hello");

      const result = await setupConversation({
        accountId: "account-123",
        roomId: "existing-room",
        promptMessage,
      });

      expect(result.memoryId).toBe("new-memory-uuid");
    });

    it("returns provided memoryId when given", async () => {
      const promptMessage = createUIMessage("Hello");

      const result = await setupConversation({
        accountId: "account-123",
        roomId: "existing-room",
        promptMessage,
        memoryId: "custom-memory-id",
      });

      expect(result.memoryId).toBe("custom-memory-id");
    });
  });

  describe("error handling", () => {
    it("propagates insertMemories errors (for duplicate handling by caller)", async () => {
      const duplicateError = { code: "23505", message: "unique constraint violation" };
      mockInsertMemories.mockRejectedValue(duplicateError);
      const promptMessage = createUIMessage("Hello");

      await expect(
        setupConversation({
          accountId: "account-123",
          promptMessage,
        }),
      ).rejects.toEqual(duplicateError);
    });
  });
});
