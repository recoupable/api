import type { NextRequest } from "next/server";

/**
 * Extracts the buyer account address from the x402 payment payload.
 *
 * @param request - The NextRequest object containing the X-PAYMENT header.
 * @returns The buyer account address, or null if not found or invalid.
 */
export function getBuyerAccount(request: NextRequest): string | null {
  const xPaymentHeader = request.headers.get("X-PAYMENT");
  if (!xPaymentHeader) return null;

  try {
    const decoded = Buffer.from(xPaymentHeader, "base64").toString("utf-8");
    const paymentPayload = JSON.parse(decoded);
    return paymentPayload.payload?.authorization?.from || null;
  } catch (error) {
    console.error("Error parsing X-PAYMENT header:", error);
    return null;
  }
}
