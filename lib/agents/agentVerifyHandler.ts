import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAgentVerifyBody } from "@/lib/agents/validateAgentVerifyBody";
import { generateAndStoreApiKey } from "@/lib/agents/generateAndStoreApiKey";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";

/**
 * Handles agent email verification. All prerequisite checks (body shape,
 * stored verification state, code comparison, account resolution) live in
 * `validateAgentVerifyBody`. Once validation passes, this handler issues an
 * API key and clears the Privy verification metadata.
 *
 * @param request - The incoming Next.js request with `{ email, code }` in the body
 * @returns NextResponse with `account_id`, `api_key`, and `message` on success
 */
export async function agentVerifyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await safeParseJson(request);

    const validated = await validateAgentVerifyBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { accountId, privyUserId } = validated;
    const rawKey = await generateAndStoreApiKey(accountId);
    await setPrivyCustomMetadata(privyUserId, {});

    return NextResponse.json(
      { account_id: accountId, api_key: rawKey, message: "Verified" },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] agentVerifyHandler:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
