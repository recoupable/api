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

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

import { validateUpdatePulsesRequest } from "../validateUpdatePulsesRequest";
import { upsertPulseAccount } from "@/lib/supabase/pulse_accounts/upsertPulseAccount";

describe("updatePulsesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update pulse and return array with the upserted record", async () => {
    const mockAccountId = "account-123";
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue({
      accountId: mockAccountId,
      active: true,
    });

    // upsertPulseAccount now returns an array
    vi.mocked(upsertPulseAccount).mockResolvedValue([
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
    expect(data.pulses[0]).toEqual({
      id: "pulse-1",
      account_id: mockAccountId,
      active: true,
    });
    expect(upsertPulseAccount).toHaveBeenCalledWith({
      account_id: mockAccountId,
      active: true,
    });
  });

  it("should return 500 error if upsert fails", async () => {
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue({
      accountId: "account-1",
      active: true,
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

  it("should return 500 error if upsert returns empty array", async () => {
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue({
      accountId: "account-1",
      active: true,
    });

    vi.mocked(upsertPulseAccount).mockResolvedValue([]);

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

  it("should pass validation error response through", async () => {
    const { NextResponse } = await import("next/server");
    const errorResponse = NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 },
    );
    vi.mocked(validateUpdatePulsesRequest).mockResolvedValue(errorResponse);

    const request = new NextRequest("http://localhost/api/pulses", {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    const response = await updatePulsesHandler(request);

    expect(response.status).toBe(401);
  });
});
