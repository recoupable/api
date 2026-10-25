import type {
  VerificationEvidence,
  VerifiedCredential,
  AccountAccessObservation,
  OrganizationAccessObservation,
} from "./VerificationEvidence";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";

/**
 * Input parameters for auth context validation.
 * These typically come from the request body after schema validation.
 */
export interface AuthContextInput {
  /** Optional account_id override from request body */
  accountId?: string;
  /** Optional organization_id from request body */
  organizationId?: string | null;
  /** Defaults to true; false keeps Privy authentication from onboarding an account. */
  allowAccountCreation?: boolean;
  /** Server-only opt-in, never a body field; forces existing-account-only authentication. */
  includeVerificationEvidence?: boolean;
}

/**
 * Validated auth context result.
 * Contains the resolved accountId, orgId, and auth token.
 */
export interface AuthContext {
  /** The resolved account ID (from API key or override) */
  accountId: string;
  /** The organization context (from API key or request body) */
  orgId: string | null;
  /** The auth token for forwarding to downstream services */
  authToken: string;
  verificationEvidence?: VerificationEvidence;
}

/**
 * Validates authentication headers and authorization context for API requests.
 *
 * This is the single source of truth for:
 * 1. Authenticating via x-api-key or Authorization bearer token
 * 2. Resolving the accountId (from auth or body override)
 * 3. Validating account_id override access (org keys can access member accounts, personal keys can access own account)
 * 4. Validating organization_id access (account must be a member of the org)
 *
 * @param request - The NextRequest object
 * @param input - Optional overrides from the request body
 * @returns A NextResponse with an error or the validated AuthContext
 */
export async function validateAuthContext(
  request: NextRequest,
  input: AuthContextInput = {},
): Promise<NextResponse | AuthContext> {
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const hasApiKey = !!apiKey;
  const hasAuth = !!authHeader;

  // Enforce exactly one auth mechanism
  if ((hasApiKey && hasAuth) || (!hasApiKey && !hasAuth)) {
    return errorResponse("Exactly one of x-api-key or Authorization must be provided", 401);
  }

  const collected: {
    credential?: VerifiedCredential;
    accountAccess?: AccountAccessObservation;
    organizationAccess?: OrganizationAccessObservation;
  } = {};
  const onVerified = input.includeVerificationEvidence
    ? (credential: VerifiedCredential) => {
        collected.credential = credential;
      }
    : undefined;
  let accountId: string;
  let authToken: string;

  if (hasApiKey) {
    // Validate API key authentication
    const accountIdOrError = onVerified
      ? await getApiKeyAccountId(request, onVerified)
      : await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    accountId = accountIdOrError;
    authToken = apiKey!;
  } else {
    // Validate bearer token authentication
    const accountIdOrError = onVerified
      ? await getAuthenticatedAccountId(request, { allowAccountCreation: false, onVerified })
      : input.allowAccountCreation === false
        ? await getAuthenticatedAccountId(request, { allowAccountCreation: false })
        : await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    accountId = accountIdOrError;
    authToken = authHeader!.replace(/^Bearer\s+/i, "");
  }

  const actorAccountId = accountId;
  collected.accountAccess = { basis: "self" };

  // Handle account_id override from request body
  if (input.accountId) {
    if (onVerified) collected.accountAccess = undefined;
    const overrideResult = await validateAccountIdOverride({
      currentAccountId: accountId,
      targetAccountId: input.accountId,
      ...(onVerified
        ? {
            onAllowed: (observation: AccountAccessObservation) => {
              collected.accountAccess = observation;
            },
          }
        : {}),
    });

    if (overrideResult instanceof NextResponse) {
      return overrideResult;
    }

    accountId = overrideResult.accountId;
  }

  // Handle organization_id from request body
  if (input.organizationId) {
    const hasOrgAccess = await validateOrganizationAccess({
      accountId,
      organizationId: input.organizationId,
      ...(onVerified
        ? {
            onAllowed: (observation: OrganizationAccessObservation) => {
              collected.organizationAccess = observation;
            },
          }
        : {}),
    });

    if (!hasOrgAccess) {
      return errorResponse("Access denied to specified organization_id", 403);
    }
  }

  if (
    onVerified &&
    (!collected.credential ||
      !collected.accountAccess ||
      (input.organizationId && !collected.organizationAccess))
  ) {
    return errorResponse("Verified authorization evidence unavailable", 401);
  }
  return {
    accountId,
    orgId: input.organizationId ?? null,
    authToken,
    ...(onVerified
      ? {
          verificationEvidence: {
            principal: { ...collected.credential!, actorAccountId },
            effectiveAccountId: accountId,
            accountAccess: collected.accountAccess!,
            organizationAccess: collected.organizationAccess ?? null,
            executionResources: {
              status: "unresolved" as const,
              reason: "resource_authorization_contract_missing" as const,
            },
          },
        }
      : {}),
  };
}
