import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getPulsesHandler } from "../getPulsesHandler";

// Mock dependencies
vi.mock("../validateGetPulsesRequest", () => ({
  validateGetPulsesRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/pulse_accounts/selectPulseAccounts", () => ({
  selectPulseAccounts: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

import { validateGetPulsesRequest } from "../validateGetPulsesRequest";
import { selectPulseAccounts } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";

describe("getPulsesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return array of pulses for personal key", async () => {
    const mockAccountId = "account-123";
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      accountIds: [mockAccountId],
      active: undefined,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: mockAccountId, active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toBeInstanceOf(Array);
    expect(data.pulses).toHaveLength(1);
    expect(data.pulses[0]).toEqual({
      id: "pulse-1",
      account_id: mockAccountId,
      active: true,
    });
  });

  it("should return array of pulses for org key with multiple accounts", async () => {
    const mockAccountIds = ["account-1", "account-2", "account-3"];
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      accountIds: mockAccountIds,
      active: undefined,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "account-1", active: true },
      { id: "pulse-2", account_id: "account-2", active: false },
    ]);

    const request = new NextRequest("http://localhost/api/pulses");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toBeInstanceOf(Array);
    expect(data.pulses).toHaveLength(3);
    // Account-3 should have default values since no pulse record exists
    expect(data.pulses.find((p: { account_id: string }) => p.account_id === "account-3")).toEqual({
      id: null,
      account_id: "account-3",
      active: false,
    });
  });

  it("should return ALL pulse records for Recoup admin key", async () => {
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      accountIds: null, // null indicates Recoup admin
      active: undefined,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "account-1", active: true },
      { id: "pulse-2", account_id: "account-2", active: false },
      { id: "pulse-3", account_id: "account-3", active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toBeInstanceOf(Array);
    expect(data.pulses).toHaveLength(3);
    expect(selectPulseAccounts).toHaveBeenCalledWith({ active: undefined });
  });

  it("should filter by active status when provided", async () => {
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      accountIds: ["account-1", "account-2"],
      active: true,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "account-1", active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses?active=true");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toHaveLength(1);
    expect(selectPulseAccounts).toHaveBeenCalledWith({
      accountIds: ["account-1", "account-2"],
      active: true,
    });
  });

  it("should return default pulse for accounts without records when no active filter", async () => {
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      accountIds: ["account-1"],
      active: undefined,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([]); // No pulse records

    const request = new NextRequest("http://localhost/api/pulses");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toHaveLength(1);
    expect(data.pulses[0]).toEqual({
      id: null,
      account_id: "account-1",
      active: false,
    });
  });

  it("should only call selectPulseAccounts once", async () => {
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      accountIds: ["account-1", "account-2"],
      active: undefined,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "account-1", active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses");
    await getPulsesHandler(request);

    expect(selectPulseAccounts).toHaveBeenCalledTimes(1);
  });
});
