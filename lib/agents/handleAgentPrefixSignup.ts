import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createAccountWithEmail } from "@/lib/agents/createAccountWithEmail";
import { generateAndStoreApiKey } from "@/lib/agents/generateAndStoreApiKey";
import { createPrivyUser } from "@/lib/privy/createPrivyUser";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";

const GENERIC_MESSAGE =
  "If this is a new agent+ email, your API key is included. Otherwise, check your email for a verification code.";

/**
 * Instant-signup path for fresh `agent+` emails — creates the account, a
 * matching Privy user, and an API key, then returns the key immediately.
 *
 * @param email - The `agent+` email address
 * @returns NextResponse with the freshly generated API key
 */
export async function handleAgentPrefixSignup(email: string): Promise<NextResponse> {
  const accountId = await createAccountWithEmail(email);

  const privyUser = await createPrivyUser(email);
  await setPrivyCustomMetadata(privyUser.id, {});

  const rawKey = await generateAndStoreApiKey(accountId);

  return NextResponse.json(
    { account_id: accountId, api_key: rawKey, message: GENERIC_MESSAGE },
    { status: 200, headers: getCorsHeaders() },
  );
}
