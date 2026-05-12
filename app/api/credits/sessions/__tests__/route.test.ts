import { vi, describe, it, expect } from "vitest";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateCreditsSessionRequest", () => ({
  validateCreateCreditsSessionRequest: vi.fn(),
}));

vi.mock("@/lib/stripe/createCreditsStripeSession", () => ({
  createCreditsStripeSession: vi.fn(),
}));

const { POST, OPTIONS } = await import("../route");

describe("app/api/credits/sessions/route", () => {
  it("exports POST and OPTIONS handlers", () => {
    expect(typeof POST).toBe("function");
    expect(typeof OPTIONS).toBe("function");
  });
});
