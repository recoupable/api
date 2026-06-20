import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const uploadConnectorFileBodySchema = z.object({
  url: z
    .string({ message: "url is required" })
    .url("url must be a valid URL (a publicly reachable image link)"),
  toolSlug: z
    .string({ message: "toolSlug is required" })
    .min(1, "toolSlug cannot be empty (e.g., 'LINKEDIN_CREATE_LINKED_IN_POST')"),
});

export type UploadConnectorFileBody = z.infer<typeof uploadConnectorFileBodySchema>;

/**
 * Validates request body for POST /api/connectors/files.
 *
 * Body shape: { url, toolSlug }.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateUploadConnectorFileBody(
  body: unknown,
): NextResponse | UploadConnectorFileBody {
  const result = uploadConnectorFileBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
