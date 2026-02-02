import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { insertAccountSandbox } from "../insertAccountSandbox";

describe("insertAccountSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it("inserts an account sandbox record and returns data on success", async () => {
    const mockData = {
      id: "sandbox-record-123",
      account_id: "account-456",
      sandbox_id: "sbx_789",
      created_at: "2024-01-01T00:00:00.000Z",
    };
    mockSingle.mockResolvedValue({ data: mockData, error: null });

    const result = await insertAccountSandbox({
      account_id: "account-456",
      sandbox_id: "sbx_789",
    });

    expect(mockFrom).toHaveBeenCalledWith("account_sandboxes");
    expect(mockInsert).toHaveBeenCalledWith({
      account_id: "account-456",
      sandbox_id: "sbx_789",
    });
    expect(result).toEqual({ data: mockData, error: null });
  });

  it("returns error when insert fails", async () => {
    const mockError = { message: "Insert failed", code: "23505" };
    mockSingle.mockResolvedValue({ data: null, error: mockError });

    const result = await insertAccountSandbox({
      account_id: "account-456",
      sandbox_id: "sbx_789",
    });

    expect(mockFrom).toHaveBeenCalledWith("account_sandboxes");
    expect(result).toEqual({ data: null, error: mockError });
  });

  it("returns error when account_id foreign key constraint fails", async () => {
    const mockError = {
      message: 'insert or update on table "account_sandboxes" violates foreign key constraint',
      code: "23503",
    };
    mockSingle.mockResolvedValue({ data: null, error: mockError });

    const result = await insertAccountSandbox({
      account_id: "non-existent-account",
      sandbox_id: "sbx_789",
    });

    expect(result).toEqual({ data: null, error: mockError });
  });
});
