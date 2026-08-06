import { describe, it, expect, vi, beforeEach } from "vitest";

import { insertCreditsUsage } from "../insertCreditsUsage";

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const ACCOUNT = "11111111-1111-1111-1111-111111111111";

describe("insertCreditsUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: { account_id: ACCOUNT }, error: null });
  });

  it("omits timestamp entirely when none is supplied, leaving existing callers unchanged", async () => {
    await insertCreditsUsage(ACCOUNT, 333);

    expect(mockFrom).toHaveBeenCalledWith("credits_usage");
    expect(mockInsert).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      remaining_credits: 333,
    });
  });

  it("writes the supplied timestamp so the monthly-reset clock starts where the caller says", async () => {
    await insertCreditsUsage(ACCOUNT, 9999, "2026-08-06T23:00:00.000Z");

    expect(mockInsert).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      remaining_credits: 9999,
      timestamp: "2026-08-06T23:00:00.000Z",
    });
  });

  it("returns null when the insert fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "nope" } });

    expect(await insertCreditsUsage(ACCOUNT, 333)).toBeNull();
  });
});
