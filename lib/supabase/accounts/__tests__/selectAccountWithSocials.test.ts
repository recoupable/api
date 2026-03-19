import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectAccountWithSocials } from "../selectAccountWithSocials";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectAccountWithSocials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it("returns account with socials and info when found", async () => {
    const mockData = {
      id: "account-123",
      name: "Test Artist",
      timestamp: 1704067200000,
      account_socials: [{ id: "social-1", platform: "spotify" }],
      account_info: [
        {
          id: "info-1",
          image: "https://example.com/image.jpg",
          updated_at: "2024-01-01T12:00:00Z",
        },
      ],
    };
    mockSingle.mockResolvedValue({ data: mockData, error: null });

    const result = await selectAccountWithSocials("account-123");

    expect(mockFrom).toHaveBeenCalledWith("accounts");
    expect(mockSelect).toHaveBeenCalledWith("*, account_socials(*), account_info(*)");
    expect(mockEq).toHaveBeenCalledWith("id", "account-123");
    expect(result).toEqual({
      ...mockData,
      created_at: new Date(mockData.timestamp).toISOString(),
      updated_at: "2024-01-01T12:00:00Z",
    });
  });

  it("returns null when account is not found", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "Row not found" },
    });

    const result = await selectAccountWithSocials("nonexistent-id");

    expect(result).toBeNull();
  });

  it("returns null when query fails", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const result = await selectAccountWithSocials("account-123");

    expect(result).toBeNull();
  });
});
