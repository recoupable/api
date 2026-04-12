import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { AGENT_SIGNUP_GENERIC_MESSAGE } from "@/lib/const";
import { validateAgentSignupBody } from "@/lib/agents/validateAgentSignupBody";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { isAgentPrefixEmail } from "@/lib/agents/isAgentPrefixEmail";
import { handleAgentPrefixSignup } from "@/lib/agents/handleAgentPrefixSignup";
import { handleExistingAccount } from "@/lib/agents/handleExistingAccount";
import { handleNormalSignup } from "@/lib/agents/handleNormalSignup";

/**
 * Handles agent signup — validates the request and dispatches to the
 * instant-signup, existing-account, or normal-signup path.
 *
 * @param request - The incoming Next.js request with `{ email }` in the body
 * @returns NextResponse with `account_id`, `api_key` (or null), and `message`
 */
export async function agentSignupHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateAgentSignupBody(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { email } = validated;

    const existingAccount = await selectAccountByEmail(email);
    if (existingAccount) {
      return handleExistingAccount(existingAccount.account_id, email);
    }

    if (isAgentPrefixEmail(email)) {
      return handleAgentPrefixSignup(email);
    }

    return handleNormalSignup(email);
  } catch (error) {
    console.error("[ERROR] agentSignupHandler:", error);
    return NextResponse.json(
      { account_id: null, api_key: null, message: AGENT_SIGNUP_GENERIC_MESSAGE },
      { status: 200, headers: getCorsHeaders() },
    );
  }
}
