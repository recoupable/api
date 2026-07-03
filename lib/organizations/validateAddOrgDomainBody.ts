import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { normalizeOrgDomain } from "@/lib/organizations/normalizeOrgDomain";

export const addOrgDomainBodySchema = z.object({
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

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { status: "error", message },
    { status: 400, headers: getCorsHeaders() },
  );
}

/**
 * Validates request body for POST /api/organizations/domains.
 * Normalizes the domain (lowercase, trimmed, leading "@" stripped) and
 * rejects strings that are not a plausible bare domain.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateAddOrgDomainBody(body: unknown): NextResponse | AddOrgDomainBody {
  const result = addOrgDomainBodySchema.safeParse(body);

  if (!result.success) {
    return badRequest(result.error.issues[0].message);
  }

  const domain = normalizeOrgDomain(result.data.domain);

  if (!domain) {
    return badRequest('domain must be a bare email domain (e.g. "seekermusic.com")');
  }

  return { organizationId: result.data.organizationId, domain };
}
