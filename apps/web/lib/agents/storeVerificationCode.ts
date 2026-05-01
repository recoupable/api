import { randomInt } from "crypto";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";
import { createPrivyUser } from "@/lib/privy/createPrivyUser";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";
import { sendVerificationEmail } from "@/lib/agents/sendVerificationEmail";

const EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Generates a 6-digit verification code, stores its hash in the Privy user's
 * `custom_metadata` (creating the Privy user if needed), and emails the code.
 *
 * @param email - Email to deliver the verification code to
 */
export async function storeVerificationCode(email: string): Promise<void> {
  // randomInt upper bound is exclusive — use 1000000 so 999999 is reachable.
  const code = randomInt(100000, 1000000).toString();
  const codeHash = hashApiKey(code, PRIVY_PROJECT_SECRET);
  const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();

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
