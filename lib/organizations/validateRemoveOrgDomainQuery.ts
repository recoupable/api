import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { normalizeOrgDomain } from "@/lib/organizations/normalizeOrgDomain";

export const removeOrgDomainQuerySchema = z.object({
  organization_id: z
    .string({ message: "organization_id is required" })
    .uuid("organization_id must be a valid UUID"),
  domain: z.string({ message: "domain is required" }),
});

export interface RemoveOrgDomainQuery {
  organization_id: string;
  /** The normalized bare email domain (lowercase, no "@") */
  domain: string;
}

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { status: "error", message },
    { status: 400, headers: getCorsHeaders() },
  );
}

/**
 * Validates query parameters for DELETE /api/organizations/domains.
 * Normalizes the domain (lowercase, trimmed, leading "@" stripped) and
 * rejects strings that are not a plausible bare domain.
 *
 * @param request - The request object
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export function validateRemoveOrgDomainQuery(
  request: NextRequest,
): NextResponse | RemoveOrgDomainQuery {
  const { searchParams } = new URL(request.url);
  const result = removeOrgDomainQuerySchema.safeParse({
    organization_id: searchParams.get("organization_id") ?? undefined,
    domain: searchParams.get("domain") ?? undefined,
  });

  if (!result.success) {
    return badRequest(result.error.issues[0].message);
  }

  const domain = normalizeOrgDomain(result.data.domain);

  if (!domain) {
    return badRequest('domain must be a bare email domain (e.g. "seekermusic.com")');
  }

  return { organization_id: result.data.organization_id, domain };
}
