import { vi, describe, it, expect } from "vitest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/stripeWebhookHandler", () => ({
  stripeWebhookHandler: vi.fn(),
}));

const { POST, OPTIONS } = await import("../route");

describe("app/api/webhooks/stripe/route", () => {
  it("exports POST and OPTIONS handlers", () => {
    expect(typeof POST).toBe("function");
    expect(typeof OPTIONS).toBe("function");
  });
});
