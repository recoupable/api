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
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: mockAccountId, active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toHaveLength(1);
    expect(selectPulseAccounts).toHaveBeenCalledWith({ accountIds: [mockAccountId] });
  });

  it("should return pulses for org key using orgId filter", async () => {
    const mockOrgId = "org-123";
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      orgId: mockOrgId,
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "member-1", active: true },
      { id: "pulse-2", account_id: "member-2", active: false },
    ]);

    const request = new NextRequest("http://localhost/api/pulses");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toHaveLength(2);
    expect(selectPulseAccounts).toHaveBeenCalledWith({ orgId: mockOrgId });
  });

  it("should return ALL pulse records for Recoup admin key", async () => {
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({});

    vi.mocked(selectPulseAccounts).mockResolvedValue([
      { id: "pulse-1", account_id: "account-1", active: true },
      { id: "pulse-2", account_id: "account-2", active: false },
      { id: "pulse-3", account_id: "account-3", active: true },
    ]);

    const request = new NextRequest("http://localhost/api/pulses");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toHaveLength(3);
    expect(selectPulseAccounts).toHaveBeenCalledWith({});
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

  it("should return empty array when no pulse records exist", async () => {
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      accountIds: ["account-1"],
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/pulses");
    const response = await getPulsesHandler(request);
    const data = await response.json();

    expect(data.status).toBe("success");
    expect(data.pulses).toHaveLength(0);
  });

  it("should only call selectPulseAccounts once", async () => {
    vi.mocked(validateGetPulsesRequest).mockResolvedValue({
      accountIds: ["account-1"],
    });

    vi.mocked(selectPulseAccounts).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/pulses");
    await getPulsesHandler(request);

    expect(selectPulseAccounts).toHaveBeenCalledTimes(1);
  });
});
