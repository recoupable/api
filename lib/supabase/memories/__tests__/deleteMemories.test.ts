import { beforeEach, describe, expect, it, vi } from "vitest";
import deleteMemories from "@/lib/supabase/memories/deleteMemories";

const mockFrom = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();

let queryError: { message: string } | null = null;

/**
 * Minimal thenable query mock that mirrors the Supabase delete builder.
 */
class MockDeleteQuery implements PromiseLike<{ error: { message: string } | null }> {
  /**
   * Captures trailing-boundary filter calls.
   *
   * @param args - Supabase gte arguments.
   * @returns The same query instance for chaining.
   */
  gte = (...args: [string, string]): MockDeleteQuery => {
    mockGte(...args);
    return this;
  };

  /**
   * Resolves the mocked Supabase query execution result.
   *
   * @param onfulfilled - Fulfillment callback.
   * @param onrejected - Rejection callback.
   * @returns Promise-like query resolution.
   */
  then<TResult1 = { error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ error: queryError }).then(onfulfilled, onrejected);
  }
}

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        delete: (...dArgs: unknown[]) => {
          mockDelete(...dArgs);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return new MockDeleteQuery();
            },
          };
        },
      };
    },
  },
}));

describe("deleteMemories", () => {
  const roomId = "123e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    queryError = null;
  });

  it("deletes all memories in a room when no boundary is provided", async () => {
    const result = await deleteMemories(roomId);

    expect(mockFrom).toHaveBeenCalledWith("memories");
    expect(mockEq).toHaveBeenCalledWith("room_id", roomId);
    expect(mockGte).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("applies immutable created_at boundary when fromCreatedAt is provided", async () => {
    const result = await deleteMemories(roomId, {
      fromCreatedAt: "2026-03-31T00:00:00.000Z",
    });

    expect(mockGte).toHaveBeenCalledWith("created_at", "2026-03-31T00:00:00.000Z");
    expect(result).toBe(true);
  });

  it("returns false for explicit empty fromCreatedAt to avoid broad deletes", async () => {
    const result = await deleteMemories(roomId, { fromCreatedAt: "" });

    expect(mockGte).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("returns false when Supabase delete fails", async () => {
    queryError = { message: "delete failed" };

    const result = await deleteMemories(roomId, {
      fromCreatedAt: "2026-03-31T00:00:00.000Z",
    });

    expect(result).toBe(false);
  });
});
