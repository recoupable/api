import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIlike = vi.fn();
const mockEq = vi.fn(() => ({ ilike: mockIlike }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("../../serverClient", () => ({
  default: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const { selectAccountByNameInOrg } = await import("../selectAccountByNameInOrg");

beforeEach(() => {
  vi.clearAllMocks();
  mockIlike.mockResolvedValue({ data: [], error: null });
});

describe("selectAccountByNameInOrg", () => {
  it("queries account_organization_ids with organization_id and joins accounts", async () => {
    await selectAccountByNameInOrg("org-1", "Mac Miller");

    expect(mockFrom).toHaveBeenCalledWith("account_organization_ids");
    expect(mockSelect).toHaveBeenCalledWith(
      "account:accounts!account_organization_ids_account_id_fkey ( id, name )",
    );
    expect(mockEq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(mockIlike).toHaveBeenCalledWith("account.name", "%Mac Miller%");
  });

  it("returns matching accounts", async () => {
    mockIlike.mockResolvedValue({
      data: [{ account: { id: "artist-1", name: "Mac Miller" } }],
      error: null,
    });

    const result = await selectAccountByNameInOrg("org-1", "Mac Miller");

    expect(result).toEqual([{ id: "artist-1", name: "Mac Miller" }]);
  });

  it("returns empty array when no matches found", async () => {
    mockIlike.mockResolvedValue({ data: [], error: null });

    const result = await selectAccountByNameInOrg("org-1", "Unknown Artist");

    expect(result).toEqual([]);
  });

  it("returns empty array on database error", async () => {
    mockIlike.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const result = await selectAccountByNameInOrg("org-1", "Mac Miller");

    expect(result).toEqual([]);
  });

  it("filters out rows where account is null", async () => {
    mockIlike.mockResolvedValue({
      data: [{ account: { id: "artist-1", name: "Mac Miller" } }, { account: null }],
      error: null,
    });

    const result = await selectAccountByNameInOrg("org-1", "Mac");

    expect(result).toEqual([{ id: "artist-1", name: "Mac Miller" }]);
  });
});
