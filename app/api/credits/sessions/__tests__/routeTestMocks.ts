import { vi } from "vitest";

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
