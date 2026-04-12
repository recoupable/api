import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAgentVerifyBody } from "@/lib/agents/validateAgentVerifyBody";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { generateApiKey } from "@/lib/keys/generateApiKey";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";

const GENERIC_ERROR = "Invalid or expired verification code.";
const MAX_ATTEMPTS = 5;

/**
 * Handles agent email verification — validates the request body, checks the
 * submitted code against the stored hash, and returns an API key on success.
 *
 * @param request - The incoming Next.js request with `{ email, code }` in the body
 * @returns NextResponse with `account_id`, `api_key`, and `message` on success
 */
export async function agentVerifyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await safeParseJson(request);

    const validated = validateAgentVerifyBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { email, code } = validated;
    // Look up Privy user and custom_metadata
    const privyUser = await getPrivyUserByEmail(email);
    if (!privyUser?.custom_metadata) {
      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const metadata = privyUser.custom_metadata as {
      verification_code_hash?: string;
      verification_expires_at?: string;
      verification_attempts?: number;
    };

    // No code stored
    if (!metadata.verification_code_hash) {
      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    // Expired — fail-safe: missing expiry is treated as expired
    if (!metadata.verification_expires_at) {
      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 400, headers: getCorsHeaders() },
      );
    }
    const expiresAt = new Date(metadata.verification_expires_at).getTime();
    if (Date.now() > expiresAt) {
      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    // Too many attempts
    const attempts = metadata.verification_attempts ?? 0;
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many failed verification attempts. Please request a new code." },
        { status: 429, headers: getCorsHeaders() },
      );
    }

    // Compare hashes
    const providedHash = hashApiKey(code, process.env.PROJECT_SECRET!);
    if (providedHash !== metadata.verification_code_hash) {
      // Increment attempts
      await setPrivyCustomMetadata(privyUser.id, {
        ...metadata,
        verification_attempts: attempts + 1,
      });

      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    // Code matches — generate API key
    const existingAccount = await selectAccountByEmail(email);
    if (!existingAccount) {
      return NextResponse.json(
        { error: GENERIC_ERROR },
        { status: 400, headers: getCorsHeaders() },
      );
    }

    const accountId = existingAccount.account_id;
    const today = new Date().toISOString().slice(0, 10);
    const rawKey = generateApiKey("recoup_sk");
    const keyHash = hashApiKey(rawKey, process.env.PROJECT_SECRET!);
    const { error: insertError } = await insertApiKey({
      name: `Agent ${today}`,
      account: accountId,
      key_hash: keyHash,
    });
    if (insertError) {
      console.error("[ERROR] agentVerifyHandler: insertApiKey failed", insertError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    // Clear custom_metadata
    await setPrivyCustomMetadata(privyUser.id, {});

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
