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
 * 2. Delegates to canAccessAccount which handles org key, shared org, and admin access
 *
 * @param params - The validation parameters
 * @returns NextResponse with error or the validated result
 */
export async function validateAccountIdOverride(
  params: ValidateAccountIdOverrideParams,
): Promise<NextResponse | ValidateAccountIdOverrideResult> {
  const { currentAccountId, targetAccountId, orgId } = params;

  // Self-access is always allowed
  if (targetAccountId === currentAccountId) {
    return { accountId: targetAccountId };
  }

  const hasAccess = await canAccessAccount({
    orgId,
    targetAccountId,
    currentAccountId,
  });

  if (hasAccess) {
    return { accountId: targetAccountId };
  }

  return NextResponse.json(
    { status: "error", error: "Access denied to specified account_id" },
    { status: 403, headers: getCorsHeaders() },
  );
}
