import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIn = vi.fn();
const mockSelect = vi.fn(() => ({ in: mockIn }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("../../serverClient", () => ({
  default: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const { selectAccountEmails } = await import("../selectAccountEmails");

beforeEach(() => {
  vi.clearAllMocks();
  mockIn.mockResolvedValue({ data: [], error: null });
});

describe("selectAccountEmails", () => {
  it("returns empty array for empty input without querying", async () => {
    const result = await selectAccountEmails([]);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("queries account_emails by account IDs", async () => {
    await selectAccountEmails(["acc-1", "acc-2"]);

    expect(mockFrom).toHaveBeenCalledWith("account_emails");
    expect(mockIn).toHaveBeenCalledWith("account_id", ["acc-1", "acc-2"]);
  });

  it("returns email rows for matching accounts", async () => {
    mockIn.mockResolvedValue({
      data: [
        { account_id: "acc-1", email: "alice@example.com" },
        { account_id: "acc-2", email: "bob@example.com" },
      ],
      error: null,
    });

    const result = await selectAccountEmails(["acc-1", "acc-2"]);

    expect(result).toEqual([
      { account_id: "acc-1", email: "alice@example.com" },
      { account_id: "acc-2", email: "bob@example.com" },
    ]);
  });

  it("throws on database error", async () => {
    const dbError = { message: "DB error", code: "500" };
    mockIn.mockResolvedValue({ data: null, error: dbError });

    await expect(selectAccountEmails(["acc-1"])).rejects.toEqual(dbError);
  });
});
