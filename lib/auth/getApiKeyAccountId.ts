import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";

/**
 * Extracts the API key from the `x-api-key` header and returns the associated
 * account ID, delegating the hash/lookup/TTL check to `getAccountIdByApiKey`
 * (shared with the Bearer path).
 *
 * @param request - The NextRequest object
 * @returns Either the account ID string, or a NextResponse error if validation fails
 */
export async function getApiKeyAccountId(request: NextRequest): Promise<string | NextResponse> {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json(
      { status: "error", message: "x-api-key header required" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  const accountId = await getAccountIdByApiKey(apiKey);

  if (!accountId) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  return accountId;
}
