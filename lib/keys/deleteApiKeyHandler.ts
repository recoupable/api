import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteApiKeyBody } from "@/lib/keys/validateDeleteApiKeyBody";
import { deleteApiKey } from "@/lib/supabase/account_api_keys/deleteApiKey";

/**
 * Handler for deleting an API key.
 *
 * Body parameters:
 * - id (required): The ID of the API key to delete
 *
 * @param request - The request object containing the body with id.
 * @returns A NextResponse with the delete operation status.
 */
export async function deleteApiKeyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const validatedBody = validateDeleteApiKeyBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const { error } = await deleteApiKey(validatedBody.id);

    if (error) {
      console.error("Error deleting API key:", error);
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to delete API key",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message: "API key deleted successfully",
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error deleting API key:", error);
    const message = error instanceof Error ? error.message : "Failed to delete API key";
    return NextResponse.json(
      {
        status: "error",
        message,
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
