import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";
import { selectAccountApiKeys } from "@/lib/supabase/account_api_keys/selectAccountApiKeys";

/**
 * Extracts and validates the API key from the request,
 * then returns the associated account ID.
 *
 * @param request - The NextRequest object
 * @returns Either the account ID string, or a NextResponse error if validation fails
 */
export async function getApiKeyAccountId(request: NextRequest): Promise<string | NextResponse> {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json(
      {
        status: "error",
        message: "x-api-key header required",
      },
      {
        status: 401,
        headers: getCorsHeaders(),
      },
    );
  }

  try {
    const keyHash = hashApiKey(apiKey, PRIVY_PROJECT_SECRET);
    const apiKeys = await selectAccountApiKeys({ keyHash });

    if (apiKeys === null) {
      console.error("[ERROR] selectAccountApiKeys returned null");
      return NextResponse.json(
        {
          status: "error",
          message: "Internal server error",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    const accountId = apiKeys[0]?.account ?? null;

    if (!accountId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Unauthorized",
        },
        {
          status: 401,
          headers: getCorsHeaders(),
        },
      );
    }

    return accountId;
  } catch (error) {
    console.error("[ERROR] getApiKeyAccountId:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
