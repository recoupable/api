import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIn = vi.fn();
const mockSelect = vi.fn(() => ({ in: mockIn }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("../../serverClient", () => ({
  default: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const { selectAccounts } = await import("../selectAccounts");

beforeEach(() => {
  vi.clearAllMocks();
  mockIn.mockResolvedValue({ data: [], error: null });
});

describe("selectAccounts", () => {
  it("queries by a single account ID string", async () => {
    await selectAccounts("acc-1");

    expect(mockFrom).toHaveBeenCalledWith("accounts");
    expect(mockIn).toHaveBeenCalledWith("id", ["acc-1"]);
  });

  it("queries by an array of account IDs", async () => {
    await selectAccounts(["acc-1", "acc-2"]);

    expect(mockIn).toHaveBeenCalledWith("id", ["acc-1", "acc-2"]);
  });

  it("returns empty array for empty array input", async () => {
    const result = await selectAccounts([]);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns matching account records", async () => {
    mockIn.mockResolvedValue({
      data: [{ id: "acc-1", name: "Alice", timestamp: null }],
      error: null,
    });

    const result = await selectAccounts("acc-1");

    expect(result).toEqual([{ id: "acc-1", name: "Alice", timestamp: null }]);
  });

  it("throws on database error", async () => {
    const dbError = { message: "DB error", code: "500" };
    mockIn.mockResolvedValue({ data: null, error: dbError });

    await expect(selectAccounts("acc-1")).rejects.toEqual(dbError);
  });
});
