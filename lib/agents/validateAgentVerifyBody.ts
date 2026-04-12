import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { errorResponse } from "@/lib/networking/errorResponse";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";

const GENERIC_ERROR = "Invalid or expired verification code.";
const MAX_ATTEMPTS = 5;

export const agentVerifyBodySchema = z.object({
  email: z.string({ message: "email is required" }).email("email must be a valid email address"),
  code: z.string({ message: "code is required" }).regex(/^\d{6}$/, "code must be a 6-digit number"),
});

export type AgentVerifyBody = z.infer<typeof agentVerifyBodySchema>;

/**
 * Resolved verify request — the caller is cleared to issue an API key for
 * `accountId` and clear metadata on `privyUserId`.
 */
export type ValidatedAgentVerifyRequest = {
  accountId: string;
  privyUserId: string;
};

type StoredVerification = {
  verification_code_hash?: string;
  verification_expires_at?: string;
  verification_attempts?: number;
};

/**
 * Validates a POST /api/agents/verify request end-to-end. Parses the body,
 * runs the zod schema check, looks up the Privy user, verifies the stored
 * verification metadata (code hash, expiry, attempts), compares the
 * supplied code against the stored hash (and increments attempts on
 * mismatch), and resolves the email to an account. All prerequisite
 * checks live here so the handler can reduce to "if validation passes,
 * issue an API key".
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse on any failure, or the resolved `accountId` + `privyUserId` on success
 */
export async function validateAgentVerifyBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedAgentVerifyRequest> {
  const body = await safeParseJson(request);
  const parsed = agentVerifyBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { status: "error", missing_fields: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { email, code } = parsed.data;

  const privyUser = await getPrivyUserByEmail(email);
  if (!privyUser?.custom_metadata) {
    return errorResponse(GENERIC_ERROR, 400);
  }

  const metadata = privyUser.custom_metadata as StoredVerification;

  if (!metadata.verification_code_hash) {
    return errorResponse(GENERIC_ERROR, 400);
  }

  // Fail-safe: missing expiry is treated as expired.
  if (!metadata.verification_expires_at) {
    return errorResponse(GENERIC_ERROR, 400);
  }
  if (Date.now() > new Date(metadata.verification_expires_at).getTime()) {
    return errorResponse(GENERIC_ERROR, 400);
  }

  const attempts = metadata.verification_attempts ?? 0;
  if (attempts >= MAX_ATTEMPTS) {
    return errorResponse("Too many failed verification attempts. Please request a new code.", 429);
  }

  const providedHash = hashApiKey(code, process.env.PROJECT_SECRET!);
  if (providedHash !== metadata.verification_code_hash) {
    await setPrivyCustomMetadata(privyUser.id, {
      ...metadata,
      verification_attempts: attempts + 1,
    });
    return errorResponse(GENERIC_ERROR, 400);
  }

  const existingAccount = await selectAccountByEmail(email);
  if (!existingAccount) {
    return errorResponse(GENERIC_ERROR, 400);
  }

  return { accountId: existingAccount.account_id, privyUserId: privyUser.id };
}
