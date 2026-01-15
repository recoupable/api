import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { z } from "zod";

export const createArtistBodySchema = z.object({
  name: z
    .string({ message: "name is required" })
    .min(1, "name cannot be empty"),
  account_id: z
    .string()
    .uuid("account_id must be a valid UUID")
    .optional(),
  organization_id: z
    .string()
    .uuid("organization_id must be a valid UUID")
    .optional(),
});

export type CreateArtistBody = z.infer<typeof createArtistBodySchema>;

export type ValidatedCreateArtistRequest = {
  name: string;
  accountId: string;
  organizationId?: string;
};

/**
 * Validates POST /api/artists request including API key, body parsing, schema validation,
 * and account access authorization.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated request data if validation passes.
 */
export async function validateCreateArtistBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateArtistRequest> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", error: "x-api-key header required" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  const keyDetails = await getApiKeyDetails(apiKey);
  if (!keyDetails) {
    return NextResponse.json(
      { status: "error", error: "Invalid API key" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const result = createArtistBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  // Use account_id from body if provided (org API keys only), otherwise use API key's account
  let accountId = keyDetails.accountId;
  if (result.data.account_id) {
    const hasAccess = await canAccessAccount({
      orgId: keyDetails.orgId,
      targetAccountId: result.data.account_id,
    });
    if (!hasAccess) {
      return NextResponse.json(
        { status: "error", error: "Access denied to specified account_id" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
    accountId = result.data.account_id;
  }

  return {
    name: result.data.name,
    accountId,
    organizationId: result.data.organization_id,
  };
}
