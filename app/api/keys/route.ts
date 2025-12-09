import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createApiKeyHandler } from "@/lib/keys/createApiKeyHandler";
import { deleteApiKeyHandler } from "@/lib/keys/deleteApiKeyHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/keys
 *
 * Creates a new API key record in account_api_keys.
 *
 * Body parameters:
 * - key_name (required): The name for the API key
 * - account_id (required): The account ID to associate the key with
 *
 * @param request - The request object containing the body with key_name and account_id.
 * @returns A NextResponse with the generated API key.
 */
export async function POST(request: NextRequest) {
  return createApiKeyHandler(request);
}

/**
 * DELETE /api/keys
 *
 * Deletes an API key record from account_api_keys.
 *
 * Body parameters:
 * - id (required): The ID of the API key to delete
 *
 * @param request - The request object containing the body with id.
 * @returns A NextResponse with the delete operation status.
 */
export async function DELETE(request: NextRequest) {
  return deleteApiKeyHandler(request);
}
