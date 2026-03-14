import type { NextRequest } from "next/server";

/**
 * Extracts the buyer account address from the x402 payment payload.
 *
 * @param request - The NextRequest object containing the X-PAYMENT header.
 * @returns The buyer account address.
 */
export function getBuyerAccount(request: NextRequest): string {
  const xPaymentHeader = request.headers.get("X-PAYMENT");
  const decoded = Buffer.from(xPaymentHeader, "base64").toString("utf-8");
  const paymentPayload = JSON.parse(decoded);
  return paymentPayload.payload.authorization.from;
}
