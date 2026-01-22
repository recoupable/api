import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";
import { selectAccountByWallet } from "@/lib/supabase/account_wallets/selectAccountByWallet";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { insertAccount } from "@/lib/supabase/accounts/insertAccount";
import { insertAccountEmail } from "@/lib/supabase/account_emails/insertAccountEmail";
import { insertAccountWallet } from "@/lib/supabase/account_wallets/insertAccountWallet";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";
import { assignAccountToOrg } from "@/lib/organizations/assignAccountToOrg";
import type { CreateAccountBody } from "./validateCreateAccountBody";

/**
 * Account data response shape.
 */
export type AccountDataResponse = {
  id: string;
  account_id: string;
  name?: string;
  email?: string;
  wallet?: string;
  image?: string;
  instruction?: string;
  organization?: string;
};

/**
 * Handles POST /api/accounts - Create or retrieve account by email/wallet.
 *
 * @param body - Validated request body with email and/or wallet
 * @returns NextResponse with account data
 */
export async function createAccountHandler(body: CreateAccountBody): Promise<NextResponse> {
  const { email, wallet } = body;

  try {
    // If email is provided, check account_emails
    if (email) {
      const emailRecord = await selectAccountByEmail(email);
      if (emailRecord?.account_id) {
        // Assign to org based on email domain (idempotent)
        await assignAccountToOrg(emailRecord.account_id, email);

        const accountData = await getAccountWithDetails(emailRecord.account_id);
        if (accountData) {
          return NextResponse.json(
            { data: accountData },
            { status: 200, headers: getCorsHeaders() },
          );
        }
      }
    }

    // If wallet is provided, check account_wallets
    if (wallet) {
      try {
        const account = await selectAccountByWallet(wallet);

        // Flatten the nested relations into a single object
        const accountInfo = account.account_info?.[0];
        const accountEmail = account.account_emails?.[0];
        const accountWallet = account.account_wallets?.[0];

        const accountData: AccountDataResponse = {
          id: account.id,
          account_id: account.id,
          name: account.name || undefined,
          image: accountInfo?.image || undefined,
          instruction: accountInfo?.instruction || undefined,
          organization: accountInfo?.organization || undefined,
          email: accountEmail?.email || undefined,
          wallet: accountWallet?.wallet || undefined,
        };

        return NextResponse.json({ data: accountData }, { status: 200, headers: getCorsHeaders() });
      } catch {
        // Wallet not found, continue to create new account
      }
    }

    // Create new account
    const newAccount = await insertAccount({ name: "" });

    if (email) {
      await insertAccountEmail(newAccount.id, email);
      // Assign new account to org based on email domain
      await assignAccountToOrg(newAccount.id, email);
    }

    if (wallet) {
      await insertAccountWallet(newAccount.id, wallet);
    }

    await insertCreditsUsage(newAccount.id);

    const newAccountData: AccountDataResponse = {
      id: newAccount.id,
      account_id: newAccount.id,
      email: email || "",
      wallet: wallet || "",
      image: "",
      instruction: "",
      organization: "",
    };

    return NextResponse.json({ data: newAccountData }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ message }, { status: 400, headers: getCorsHeaders() });
  }
}
