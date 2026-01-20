import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { z } from "zod";

export const createWorkspaceBodySchema = z.object({
  name: z.string().optional(),
  account_id: z.uuid({ message: "account_id must be a valid UUID" }).optional(),
  organization_id: z
    .uuid({ message: "organization_id must be a valid UUID" })
    .optional()
    .nullable(),
});

export type CreateWorkspaceBody = z.infer<typeof createWorkspaceBodySchema>;

export type ValidatedCreateWorkspaceRequest = {
  name: string;
  accountId: string;
  organizationId?: string;
};

/**
 * Validates POST /api/workspaces request including auth headers, body parsing, schema validation,
 * organization access authorization, and account access authorization.
 *
 * Supports both:
 * - x-api-key header
 * - Authorization: Bearer <token> header
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated request data if validation passes.
 */
export async function validateCreateWorkspaceBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateWorkspaceRequest> {
  // Parse and validate the request body first
  const body = await safeParseJson(request);
  const result = createWorkspaceBodySchema.safeParse(body);
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

  // Validate auth and authorization using the centralized utility
  const authContext = await validateAuthContext(request, {
    accountId: result.data.account_id,
    organizationId: result.data.organization_id,
  });

  if (authContext instanceof NextResponse) {
    return authContext;
  }

  // Default name to "Untitled" if not provided
  const workspaceName = result.data.name?.trim() || "Untitled";

  return {
    name: workspaceName,
    accountId: authContext.accountId,
    organizationId: result.data.organization_id ?? undefined,
  };
}
