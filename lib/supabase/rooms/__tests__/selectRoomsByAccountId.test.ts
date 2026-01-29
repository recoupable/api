import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectRoomsByAccountId } from "../selectRoomsByAccountId";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => ({
  default: {
    from: vi.fn(),
  },
}));

describe("selectRoomsByAccountId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Creates a mock query builder chain that supports method chaining.
   * The mock is thenable to support await.
   *
   * @param data - The data to return
   * @param error - The error to return
   * @returns A mock query builder
   */
  function createMockQueryBuilder(data: unknown, error: unknown = null) {
    // Create a thenable chainable mock
    const chainableMock = {
      eq: vi.fn(),
      order: vi.fn(),
      then: vi.fn((resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data, error });
      }),
    };

    // Make all methods return the chainable mock for chaining
    chainableMock.eq.mockReturnValue(chainableMock);
    chainableMock.order.mockReturnValue(chainableMock);

    const selectMock = vi.fn().mockReturnValue(chainableMock);
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as ReturnType<
      typeof supabase.from
    >);

    return { selectMock, chainableMock };
  }

  describe("successful queries", () => {
    it("returns rooms for a given account", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const mockRooms = [
        {
          id: "room-1",
          account_id: accountId,
          artist_id: null,
          topic: "Room 1",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "room-2",
          account_id: accountId,
          artist_id: null,
          topic: "Room 2",
          updated_at: "2024-01-02T00:00:00Z",
        },
      ];

      createMockQueryBuilder(mockRooms);

      const result = await selectRoomsByAccountId({ accountId });

      expect(result).toEqual(mockRooms);
      expect(supabase.from).toHaveBeenCalledWith("rooms");
    });

    it("filters by artist when artistId is provided", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const artistId = "123e4567-e89b-12d3-a456-426614174001";
      const mockRooms = [
        {
          id: "room-1",
          account_id: accountId,
          artist_id: artistId,
          topic: "Artist Room",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      const { chainableMock } = createMockQueryBuilder(mockRooms);

      const result = await selectRoomsByAccountId({ accountId, artistId });

      expect(result).toEqual(mockRooms);
      // Verify eq was called twice - once for account_id and once for artist_id
      expect(chainableMock.eq).toHaveBeenCalledTimes(2);
      expect(chainableMock.eq).toHaveBeenCalledWith("account_id", accountId);
      expect(chainableMock.eq).toHaveBeenCalledWith("artist_id", artistId);
    });

    it("returns empty array when no rooms found", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      createMockQueryBuilder([]);

      const result = await selectRoomsByAccountId({ accountId });

      expect(result).toEqual([]);
    });

    it("returns empty array when data is null", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      createMockQueryBuilder(null);

      const result = await selectRoomsByAccountId({ accountId });

      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("returns null when query fails", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";

      createMockQueryBuilder(null, { message: "Database error" });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await selectRoomsByAccountId({ accountId });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[ERROR] selectRoomsByAccountId:",
        expect.objectContaining({ message: "Database error" }),
      );

      consoleSpy.mockRestore();
    });
  });
});
