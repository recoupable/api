import { vi } from "vitest";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateSubscriptionSessionRequest", () => ({
  validateCreateSubscriptionSessionRequest: vi.fn(),
}));

vi.mock("@/lib/stripe/createStripeSession", () => ({
  createStripeSession: vi.fn(),
}));
