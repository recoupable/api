import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyDetails, type ApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
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
  body: CreateArtistBody;
  keyDetails: ApiKeyDetails;
};

/**
 * Validates POST /api/artists request including API key, body parsing, and schema validation.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated body and keyDetails if validation passes.
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

  return {
    body: result.data,
    keyDetails,
  };
}
