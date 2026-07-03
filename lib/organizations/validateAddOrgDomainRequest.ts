import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { normalizeOrgDomain } from "@/lib/organizations/normalizeOrgDomain";
import { z } from "zod";

const addOrgDomainBodySchema = z.object({
  organizationId: z
    .string({ message: "organizationId is required" })
    .uuid("organizationId must be a valid UUID"),
  domain: z.string({ message: "domain is required" }),
});

export interface AddOrgDomainBody {
  organizationId: string;
  /** The normalized bare email domain (lowercase, no "@") */
  domain: string;
}

export interface AddOrgDomainRequestData {
  /** The authenticated caller's account ID */
  callerAccountId: string;
  /** The validated request body */
  body: AddOrgDomainBody;
}

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { status: "error", message },
    { status: 400, headers: getCorsHeaders() },
  );
}

/**
 * Validates POST /api/organizations/domains requests.
 * Handles authentication (x-api-key or Authorization bearer token),
 * body validation, and the caller's access to manage the organization.
 * Normalizes the domain (lowercase, trimmed, leading "@" stripped) and
 * rejects strings that are not a plausible bare domain.
 *
 * Body parameters:
 * - organizationId (required): The organization's account ID
 * - domain (required): The email domain to map (e.g. "seekermusic.com")
 *
 * The caller must be a member of the organization or a Recoup admin.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error (400/401/403) if validation fails,
 *   or the caller account ID and validated body.
 */
export async function validateAddOrgDomainRequest(
  request: NextRequest,
): Promise<NextResponse | AddOrgDomainRequestData> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const rawBody = await request.json().catch(() => null);
  const result = addOrgDomainBodySchema.safeParse(rawBody);
  if (!result.success) {
    return badRequest(result.error.issues[0].message);
  }

  const domain = normalizeOrgDomain(result.data.domain);
  if (!domain) {
    return badRequest('domain must be a bare email domain (e.g. "seekermusic.com")');
  }

  const hasAccess = await canManageOrganization({
    accountId: authResult.accountId,
    organizationId: result.data.organizationId,
  });

  if (!hasAccess) {
    return NextResponse.json(
      {
        status: "error",
        message: "Access denied to specified organization_id",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return {
    callerAccountId: authResult.accountId,
    body: { organizationId: result.data.organizationId, domain },
  };
}
