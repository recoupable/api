import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
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
import type { AgentSignupBody } from "@/lib/agents/validateAgentSignupBody";

const GENERIC_MESSAGE =
  "If this is a new agent+ email, your API key is included. Otherwise, check your email for a verification code.";

/**
 * Handles agent signup flow.
 *
 * @param body - Validated signup request body
 * @returns NextResponse with account_id, api_key (or null), and message
 */
export async function agentSignupHandler(body: AgentSignupBody): Promise<NextResponse> {
  const { email } = body;

  try {
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
 * Creates a new account with email, credits, and org assignment.
 *
 * @param email - The email address for the new account
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
 * Generates a new API key, hashes it, and stores it in the database.
 *
 * @param accountId - The account ID to associate the key with
 * @returns The raw API key string
 */
async function generateAndStoreApiKey(accountId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const rawKey = generateApiKey("recoup_sk");
  const keyHash = hashApiKey(rawKey, process.env.PROJECT_SECRET!);
  await insertApiKey({ name: `Agent ${today}`, account: accountId, key_hash: keyHash });
  return rawKey;
}

/**
 * Handles instant signup for agent+ prefix emails.
 *
 * @param email - The agent+ email address
 * @returns NextResponse with api_key
 */
async function handleAgentPrefixSignup(email: string): Promise<NextResponse> {
  const accountId = await createAccountWithEmail(email);

  // Create Privy user and clear metadata
  const privyUser = await createPrivyUser(email);
  await setPrivyCustomMetadata(privyUser.id, {});

  const rawKey = await generateAndStoreApiKey(accountId);

  return NextResponse.json(
    { account_id: accountId, api_key: rawKey, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}

/**
 * Generates a verification code, stores its hash in Privy, and sends it via email.
 *
 * @param email - The email address to send the code to
 */
async function storeVerificationCode(email: string): Promise<void> {
  const code = randomInt(100000, 999999).toString();
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
 * Handles signup for an email that already has an account.
 *
 * @param accountId - The existing account ID
 * @param email - The email address
 * @returns NextResponse with null api_key
 */
async function handleExistingAccount(accountId: string, email: string): Promise<NextResponse> {
  await storeVerificationCode(email);

  return NextResponse.json(
    { account_id: accountId, api_key: null, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}

/**
 * Handles signup for a normal email (creates account, sends verification code).
 *
 * @param email - The email address
 * @returns NextResponse with null api_key
 */
async function handleNormalSignup(email: string): Promise<NextResponse> {
  const accountId = await createAccountWithEmail(email);
  await storeVerificationCode(email);

  return NextResponse.json(
    { account_id: accountId, api_key: null, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}
