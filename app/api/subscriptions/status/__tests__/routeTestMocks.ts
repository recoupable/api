import { vi } from "vitest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/getSubscriptionStatusHandler", () => ({
  getSubscriptionStatusHandler: vi.fn(),
}));
