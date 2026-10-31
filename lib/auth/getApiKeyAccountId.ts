import type { CredentialObserver } from "./VerificationEvidence";
import { NextRequest, NextResponse } from "next/server";
import { messageErrorResponse } from "@/lib/networking/messageErrorResponse";
import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";

/**
 * Extracts the API key from the `x-api-key` header and returns the associated
 * account ID, delegating the hash/lookup/TTL check to `getAccountIdByApiKey`
 * (shared with the Bearer path).
 *
 * @param request - The NextRequest object
 * @returns Either the account ID string, or a NextResponse error if validation fails
 */
export async function getApiKeyAccountId(
  request: NextRequest,
  onVerified?: CredentialObserver,
): Promise<string | NextResponse> {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return messageErrorResponse("x-api-key header required", 401);
  }

  const accountId = onVerified
    ? await getAccountIdByApiKey(apiKey, onVerified)
    : await getAccountIdByApiKey(apiKey);

  if (!accountId) {
    return messageErrorResponse("Unauthorized", 401);
  }

  return accountId;
}
