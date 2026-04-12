import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";
import { storeVerificationCode } from "@/lib/agents/storeVerificationCode";

const GENERIC_MESSAGE =
  "If this is a new agent+ email, your API key is included. Otherwise, check your email for a verification code.";

/**
 * Non-`agent+` new-account path — creates a fresh account and sends a
 * verification code. The account is created immediately but the API key is
 * only issued after the caller verifies the code via `/api/agents/verify`.
 *
 * @param email - Email for the new account
 * @returns NextResponse with `api_key: null`
 */
export async function handleNormalSignup(email: string): Promise<NextResponse> {
  const accountId = await createAccountWithEmail(email);
  await storeVerificationCode(email);

  return NextResponse.json(
    { account_id: accountId, api_key: null, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}
