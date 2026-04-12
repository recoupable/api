import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAgentSignupBody } from "@/lib/agents/validateAgentSignupBody";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountEmail } from "@/lib/supabase/account_emails/insertAccountEmail";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";
import { assignAccountToOrg } from "@/lib/organizations/assignAccountToOrg";
import { generateApiKey } from "@/lib/keys/generateApiKey";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";
import { isAgentPrefixEmail } from "@/lib/agents/isAgentPrefixEmail";
import { createPrivyUser } from "@/lib/privy/createPrivyUser";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";
import { sendVerificationEmail } from "@/lib/agents/sendVerificationEmail";

const GENERIC_MESSAGE =
  "If this is a new agent+ email, your API key is included. Otherwise, check your email for a verification code.";

/**
 * Handles agent signup flow — validates the request body and dispatches to
 * the instant-signup, existing-account, or normal-signup path.
 *
 * @param request - The incoming Next.js request with `{ email }` in the body
 * @returns NextResponse with `account_id`, `api_key` (or null), and `message`
 */
export async function agentSignupHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await safeParseJson(request);

    const validated = validateAgentSignupBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { email } = validated;

    const existingAccount = await selectAccountByEmail(email);

    if (existingAccount) {
      // Case 3c: Account exists — send verification code
      return handleExistingAccount(existingAccount.account_id, email);
    }

    if (isAgentPrefixEmail(email)) {
      // Case 3a: New account + agent+ prefix — instant key
      return handleAgentPrefixSignup(email);
    }

    // Case 3b: New account + normal email — verification required
    return handleNormalSignup(email);
  } catch (error) {
    console.error("[ERROR] agentSignupHandler:", error);
    return NextResponse.json(
      { account_id: null, api_key: null, message: GENERIC_MESSAGE },
      { status: 200, headers: getCorsHeaders() },
    );
  }
}

/**
 * Creates a new account row plus email, credits, and org assignment.
 *
 * @param email - Email to associate with the new account
 * @returns The new account ID
 */
async function createAccountWithEmail(email: string): Promise<string> {
  const account = await insertAccount({});
  await insertAccountEmail(account.id, email);
  await insertCreditsUsage(account.id);
  await assignAccountToOrg(account.id, email);
  return account.id;
}

/**
 * Generates a new API key, stores its hash, and returns the raw key.
 *
 * @param accountId - Account to associate the key with
 * @returns The raw (un-hashed) API key string
 */
async function generateAndStoreApiKey(accountId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const rawKey = generateApiKey("recoup_sk");
  const keyHash = hashApiKey(rawKey, process.env.PROJECT_SECRET!);
  await insertApiKey({ name: `Agent ${today}`, account: accountId, key_hash: keyHash });
  return rawKey;
}

/**
 * Instant-signup path for fresh `agent+` emails — returns an API key immediately.
 *
 * @param email - The `agent+` email address
 * @returns NextResponse with the freshly generated API key
 */
async function handleAgentPrefixSignup(email: string): Promise<NextResponse> {
  const accountId = await createAccountWithEmail(email);

  const privyUser = await createPrivyUser(email);
  await setPrivyCustomMetadata(privyUser.id, {});

  const rawKey = await generateAndStoreApiKey(accountId);

  return NextResponse.json(
    { account_id: accountId, api_key: rawKey, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}

/**
 * Generates a 6-digit code, stores its hash in Privy metadata, and emails it.
 *
 * @param email - Email to deliver the verification code to
 */
async function storeVerificationCode(email: string): Promise<void> {
  // randomInt upper bound is exclusive — use 1000000 to include 999999.
  const code = randomInt(100000, 1000000).toString();
  const codeHash = hashApiKey(code, process.env.PROJECT_SECRET!);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let privyUser = await getPrivyUserByEmail(email);
  if (!privyUser) {
    privyUser = await createPrivyUser(email);
  }

  await setPrivyCustomMetadata(privyUser.id, {
    verification_code_hash: codeHash,
    verification_expires_at: expiresAt,
    verification_attempts: 0,
  });

  await sendVerificationEmail(email, code);
}

/**
 * Existing-account path — always sends a verification code, never returns a key.
 *
 * @param accountId - The existing account ID
 * @param email - The email that matched an existing account
 * @returns NextResponse with `api_key: null`
 */
async function handleExistingAccount(accountId: string, email: string): Promise<NextResponse> {
  await storeVerificationCode(email);

  return NextResponse.json(
    { account_id: accountId, api_key: null, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}

/**
 * Non-`agent+` new-account path — creates the account, then sends a verification code.
 *
 * @param email - Email for the new account
 * @returns NextResponse with `api_key: null`
 */
async function handleNormalSignup(email: string): Promise<NextResponse> {
  const accountId = await createAccountWithEmail(email);
  await storeVerificationCode(email);

  return NextResponse.json(
    { account_id: accountId, api_key: null, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}
