import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { updatePulsesHandler } from "../updatePulsesHandler";

// Mock dependencies
vi.mock("../validateUpdatePulsesRequest", () => ({
  validateUpdatePulsesRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/pulse_accounts/upsertPulseAccount", () => ({
  upsertPulseAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/pulse_accounts/selectPulseAccounts", () => ({
  selectPulseAccounts: vi.fn(),
}));

vi.mock("@/lib/supabase/pulse_accounts/selectAllPulseAccounts", () => ({
  selectAllPulseAccounts: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

import { validateUpdatePulsesRequest } from "../validateUpdatePulsesRequest";
import { upsertPulseAccount } from "@/lib/supabase/pulse_accounts/upsertPulseAccount";
import { selectPulseAccounts } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";
import { selectAllPulseAccounts } from "@/lib/supabase/pulse_accounts/selectAllPulseAccounts";

describe("updatePulsesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update pulse and return array for personal key", async () => {
    const mockAccountId = "account-123";
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue({
      accountId: mockAccountId,
      active: true,
      responseAccountIds: [mockAccountId],
    });

    vi.mocked(upsertPulseAccount).mockResolvedValue({
      id: "pulse-1",
      account_id: mockAccountId,
      active: true,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: mockAccountId, active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await updatePulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toBeInstanceOf(Array);
    expect(data.pulses).toHaveLength(1);
    expect(upsertPulseAccount).toHaveBeenCalledWith({
      account_id: mockAccountId,
      active: true,
    });
  });

  it("should update pulse and return array of all org pulses for org key", async () => {
    const mockAccountIds = ["account-1", "account-2"];
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue({
      accountId: "account-1",
      active: true,
      responseAccountIds: mockAccountIds,
    });

    vi.mocked(upsertPulseAccount).mockResolvedValue({
      id: "pulse-1",
      account_id: "account-1",
      active: true,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "account-1", active: true },
      { id: "pulse-2", account_id: "account-2", active: false },
    ]);

    const request = new NextRequest("http://localhost/api/pulses", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await updatePulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toBeInstanceOf(Array);
    expect(data.pulses).toHaveLength(2);
  });

  it("should return ALL pulses for Recoup admin key after update", async () => {
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue({
      accountId: "account-1",
      active: true,
      responseAccountIds: null, // null indicates Recoup admin
    });

    vi.mocked(upsertPulseAccount).mockResolvedValue({
      id: "pulse-1",
      account_id: "account-1",
      active: true,
    });

    vi.mocked(selectAllPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "account-1", active: true },
      { id: "pulse-2", account_id: "account-2", active: false },
      { id: "pulse-3", account_id: "account-3", active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await updatePulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toBeInstanceOf(Array);
    expect(data.pulses).toHaveLength(3);
    expect(selectAllPulseAccounts).toHaveBeenCalledWith({});
  });

  it("should return 500 error if upsert fails", async () => {
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue({
      accountId: "account-1",
      active: true,
      responseAccountIds: ["account-1"],
    });

    vi.mocked(upsertPulseAccount).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/pulses", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await updatePulsesHandler(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.status).toBe("error");
    expect(data.error).toBe("Failed to update pulse status");
  });

  it("should return default pulse for accounts without records in response", async () => {
    const mockAccountIds = ["account-1", "account-2"];
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue({
      accountId: "account-1",
      active: true,
      responseAccountIds: mockAccountIds,
    });

    vi.mocked(upsertPulseAccount).mockResolvedValue({
      id: "pulse-1",
      account_id: "account-1",
      active: true,
    });

    // Only account-1 has a pulse record
    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "account-1", active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await updatePulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toHaveLength(2);
    // account-2 should have default values
    expect(data.pulses.find((p: { account_id: string }) => p.account_id === "account-2")).toEqual({
      id: null,
      account_id: "account-2",
      active: false,
    });
  });
});
