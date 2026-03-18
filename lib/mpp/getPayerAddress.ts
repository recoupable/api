import type { NextRequest } from "next/server";

/**
 * Extracts the payer account address from the MPP Authorization header credential.
 * The `source` field is a DID in the format "did:pkh:eip155:<chainId>:0x...".
 *
 * @param request - The NextRequest containing the Authorization header.
 * @returns The payer address, or empty string if not found.
 */
export function getPayerAddress(request: NextRequest): string {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return "";
  try {
    // The MPP credential is base64-encoded JSON in the Authorization header
    // Format: "Payment <base64>"
    const base64 = authHeader.replace(/^Payment\s+/i, "");
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const credential = JSON.parse(decoded);
    // source is a DID: "did:pkh:eip155:4217:0x..."
    const source: string = credential?.source ?? "";
    if (source) {
      const parts = source.split(":");
      return parts[parts.length - 1] ?? "";
    }
  } catch {
    // ignore parse errors
  }
  return "";
}
