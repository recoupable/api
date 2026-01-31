import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

/**
 * Basic schema for chat request body validation (auth phase only).
 */
const chatAuthSchema = z.object({
  prompt: z.string().optional(),
  messages: z.array(z.any()).default([]),
  roomId: z.string().optional(),
  accountId: z.string().optional(),
  artistId: z.string().optional(),
  organizationId: z.string().optional(),
  model: z.string().optional(),
  excludeTools: z.array(z.string()).optional(),
});

export type ChatAuthBody = z.infer<typeof chatAuthSchema>;

export interface ChatAuthResult {
  body: ChatAuthBody;
  accountId: string;
  orgId: string | null;
}

/**
 * Validates chat request authentication and returns the accountId.
 *
 * This function only handles:
 * - Basic schema validation
 * - Authentication (API key or Bearer token)
 * - Account ID resolution
 * - Organization access validation
 *
 * It does NOT handle conversation setup, message conversion, etc.
 * Those are handled by the x402 endpoint.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error or validated auth result
 */
export async function validateChatAuth(
  request: NextRequest,
): Promise<NextResponse | ChatAuthResult> {
  const json = await request.json();
  const validationResult = chatAuthSchema.safeParse(json);

  if (!validationResult.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Invalid input",
        errors: validationResult.error.issues.map(err => ({
          field: err.path.join("."),
          message: err.message,
        })),
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const validatedBody = validationResult.data;

  // Check which auth mechanism is provided
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const hasApiKey = !!apiKey;
  const hasAuth = !!authHeader;

  // Enforce that exactly one auth mechanism is provided
  if ((hasApiKey && hasAuth) || (!hasApiKey && !hasAuth)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Exactly one of x-api-key or Authorization must be provided",
      },
      {
        status: 401,
        headers: getCorsHeaders(),
      },
    );
  }

  // Authenticate and get accountId and orgId
  let accountId: string;
  let orgId: string | null = null;

  if (hasApiKey) {
    // Validate API key authentication
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    accountId = accountIdOrError;

    // Get org context from API key details
    const keyDetails = await getApiKeyDetails(apiKey!);
    if (keyDetails) {
      orgId = keyDetails.orgId;
    }

    // Handle accountId override for org API keys
    if (validatedBody.accountId) {
      const overrideResult = await validateOverrideAccountId({
        apiKey,
        targetAccountId: validatedBody.accountId,
      });
      if (overrideResult instanceof NextResponse) {
        return overrideResult;
      }
      accountId = overrideResult.accountId;
    }
  } else {
    // Validate bearer token authentication (no org context for JWT auth)
    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    accountId = accountIdOrError;
  }

  // Handle organizationId override from request body
  if (validatedBody.organizationId) {
    const hasOrgAccess = await validateOrganizationAccess({
      accountId,
      organizationId: validatedBody.organizationId,
    });

    if (!hasOrgAccess) {
      return NextResponse.json(
        {
          status: "error",
          message: "Access denied to specified organizationId",
        },
        {
          status: 403,
          headers: getCorsHeaders(),
        },
      );
    }

    // Use the provided organizationId as orgId
    orgId = validatedBody.organizationId;
  }

  return {
    body: validatedBody,
    accountId,
    orgId,
  };
}
