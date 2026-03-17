import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { canAccessAccountViaAnyOrg } from "@/lib/organizations/canAccessAccountViaAnyOrg";

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
 * 3. If orgId is null, checks if currentAccountId shares any org with targetAccountId
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

  // For org API keys, check if target account is a member of the org
  if (orgId) {
    const hasAccess = await canAccessAccount({
      orgId,
      targetAccountId,
    });

    if (hasAccess) {
      return { accountId: targetAccountId };
    }
  } else {
    // For personal keys, check if the key owner shares any org with the target account
    const hasAccess = await canAccessAccountViaAnyOrg({
      currentAccountId,
      targetAccountId,
    });

    if (hasAccess) {
      return { accountId: targetAccountId };
    }
  }

  // No access
  return NextResponse.json(
    { status: "error", error: "Access denied to specified account_id" },
    { status: 403, headers: getCorsHeaders() },
  );
}
