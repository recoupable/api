import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getUserAccessibleTemplates } from "./getUserAccessibleTemplates";
import { getSharedEmailsForTemplates } from "./getSharedEmailsForTemplates";

/**
 * Handler for fetching agent templates.
 *
 * Requires authentication via Authorization Bearer token.
 *
 * Query parameters:
 * - userId: Optional user ID to fetch templates for (must match authenticated user)
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the templates array or an error
 */
export async function getAgentTemplatesHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    // Authenticate using Bearer token
    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }

    const accountId = accountIdOrError;

    // Parse userId from query params (optional)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || accountId;

    // Fetch templates accessible to the user
    const templates = await getUserAccessibleTemplates(userId);

    // Get shared emails for private templates
    const privateTemplateIds = templates
      .filter((template) => template.is_private)
      .map((template) => template.id);

    let sharedEmails: Record<string, string[]> = {};
    if (privateTemplateIds.length > 0) {
      sharedEmails = await getSharedEmailsForTemplates(privateTemplateIds);
    }

    // Add shared emails to templates
    const templatesWithEmails = templates.map((template) => ({
      ...template,
      shared_emails: template.is_private
        ? sharedEmails[template.id] || []
        : [],
    }));

    return NextResponse.json(
      {
        status: "success",
        templates: templatesWithEmails,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getAgentTemplatesHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch agent templates",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
