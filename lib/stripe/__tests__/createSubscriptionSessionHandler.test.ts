import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createSubscriptionSessionHandler } from "../createSubscriptionSessionHandler";
import { validateCreateStripeSessionBody } from "../validateCreateStripeSessionBody";
import { createStripeSession } from "../createStripeSession";

vi.mock("../validateCreateStripeSessionBody", () => ({
  validateCreateStripeSessionBody: vi.fn(),
}));

vi.mock("../createStripeSession", () => ({
  createStripeSession: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const mockValidate = vi.mocked(validateCreateStripeSessionBody);
const mockCreate = vi.mocked(createStripeSession);

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/subscriptions/sessions", { method: "POST" });
}

describe("createSubscriptionSessionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("success", () => {
    it("returns 200 with id and url", async () => {
      mockValidate.mockResolvedValue({
        accountId: "account-uuid-111",
        successUrl: "https://chat.recoupable.com?success=1",
      });
      mockCreate.mockResolvedValue({
        id: "cs_test_abc123",
        url: "https://checkout.stripe.com/pay/cs_test_abc123",
      });

      const response = await createSubscriptionSessionHandler(makeRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "cs_test_abc123",
        url: "https://checkout.stripe.com/pay/cs_test_abc123",
      });
    });

    it("calls createStripeSession with resolved accountId and successUrl", async () => {
      mockValidate.mockResolvedValue({
        accountId: "account-uuid-111",
        successUrl: "https://chat.recoupable.com?success=1",
      });
      mockCreate.mockResolvedValue({
        id: "cs_test_abc123",
        url: "https://checkout.stripe.com/pay/cs_test_abc123",
      });

      await createSubscriptionSessionHandler(makeRequest());

      expect(mockCreate).toHaveBeenCalledWith(
        "account-uuid-111",
        "https://chat.recoupable.com?success=1",
      );
    });
  });

  describe("validation errors", () => {
    it("passes through 400 from validation", async () => {
      mockValidate.mockResolvedValue(
        NextResponse.json({ status: "error", error: "successUrl is required" }, { status: 400 }),
      );

      const response = await createSubscriptionSessionHandler(makeRequest());

      expect(response.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("passes through 401 from validation", async () => {
      mockValidate.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const response = await createSubscriptionSessionHandler(makeRequest());

      expect(response.status).toBe(401);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("checkout errors", () => {
    it("returns 500 when createStripeSession throws", async () => {
      mockValidate.mockResolvedValue({
        accountId: "account-uuid-111",
        successUrl: "https://chat.recoupable.com?success=1",
      });
      mockCreate.mockRejectedValue(new Error("Stripe API error"));

      const response = await createSubscriptionSessionHandler(makeRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe("error");
      expect(data.error).toBe("Internal server error");
    });

    it("returns generic 500 message for non-Error throws", async () => {
      mockValidate.mockResolvedValue({
        accountId: "account-uuid-111",
        successUrl: "https://chat.recoupable.com?success=1",
      });
      mockCreate.mockRejectedValue("unexpected string error");

      const response = await createSubscriptionSessionHandler(makeRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
