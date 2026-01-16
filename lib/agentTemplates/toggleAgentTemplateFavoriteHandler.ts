import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import insertAgentTemplateFavorite from "@/lib/supabase/agent_template_favorites/insertAgentTemplateFavorite";
import { removeAgentTemplateFavorite } from "./removeAgentTemplateFavorite";

interface ToggleFavoriteRequestBody {
  templateId?: string;
  isFavourite?: boolean;
}

/**
 * Handler for toggling agent template favorites.
 *
 * Requires authentication via Authorization Bearer token.
 *
 * Request body:
 * - templateId: The ID of the template to favorite/unfavorite
 * - isFavourite: true to add to favorites, false to remove
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with success or an error
 */
export async function toggleAgentTemplateFavoriteHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    // Authenticate using Bearer token
    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }

    const accountId = accountIdOrError;

    // Parse request body
    const body: ToggleFavoriteRequestBody = await request.json();
    const { templateId, isFavourite } = body;

    // Validate required fields
    if (!templateId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing templateId",
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    if (typeof isFavourite !== "boolean") {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing isFavourite",
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    // Toggle favorite
    if (isFavourite) {
      await insertAgentTemplateFavorite({ templateId, userId: accountId });
    } else {
      await removeAgentTemplateFavorite(templateId, accountId);
    }

    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] toggleAgentTemplateFavoriteHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to toggle favorite",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
