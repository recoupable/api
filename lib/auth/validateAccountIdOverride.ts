import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

/**
 * Parameters for account ID override validation.
 */
export interface ValidateAccountIdOverrideParams {
  /** The account ID from the authenticated API key/token */
  currentAccountId: string;
  /** The target account ID to override to */
  targetAccountId: string;
  /** The organization ID from the API key (null for personal keys) */
  orgId: string | null;
}

/**
 * Result of successful account ID override validation.
 */
export interface ValidateAccountIdOverrideResult {
  accountId: string;
}

/**
 * Validates if an account_id override is allowed.
 *
 * Access rules:
 * 1. If targetAccountId equals currentAccountId, always allowed (self-access)
 * 2. If orgId is present, checks if targetAccountId is a member of the org
 * 3. If orgId is null and targetAccountId !== currentAccountId, denied
 *
 * @param params - The validation parameters
 * @returns NextResponse with error or the validated result
 */
export async function validateAccountIdOverride(
  params: ValidateAccountIdOverrideParams,
): Promise<NextResponse | ValidateAccountIdOverrideResult> {
  const { currentAccountId, targetAccountId, orgId } = params;

  // Self-access is always allowed (personal API key accessing own account)
  if (targetAccountId === currentAccountId) {
    return { accountId: targetAccountId };
  }

  // For org API keys, check if target account is a member of the org
  if (orgId) {
    const hasAccess = await canAccessAccount({
      orgId,
      targetAccountId,
    });

    if (hasAccess) {
      return { accountId: targetAccountId };
    }
  }

  // No access - either personal key trying to access another account,
  // or org key trying to access a non-member account
  return NextResponse.json(
    { status: "error", error: "Access denied to specified account_id" },
    { status: 403, headers: getCorsHeaders() },
  );
}
