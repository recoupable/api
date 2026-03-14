import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createApiKeyHandler } from "@/lib/keys/createApiKeyHandler";
import { deleteApiKeyHandler } from "@/lib/keys/deleteApiKeyHandler";
import { getApiKeysHandler } from "@/lib/keys/getApiKeysHandler";

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
 * GET /api/keys
 *
 * Retrieves all API keys for an account from account_api_keys.
 * Requires authentication via Bearer token in Authorization header.
 * The account ID is derived from the authenticated user's Privy token.
 *
 * @param request - The request object.
 * @returns A NextResponse with the API keys.
 */
export async function GET(request: NextRequest) {
  return getApiKeysHandler(request);
}

/**
 * POST /api/keys
 *
 * Creates a new API key record in account_api_keys.
 * Requires authentication via Bearer token in Authorization header.
 * The account ID is derived from the authenticated user's Privy token.
 *
 * Body parameters:
 * - key_name (required): The name for the API key
 *
 * @param request - The request object containing the body with key_name.
 * @returns A NextResponse with the generated API key.
 */
export async function POST(request: NextRequest) {
  return createApiKeyHandler(request);
}

/**
 * DELETE /api/keys
 *
 * Deletes an API key record from account_api_keys.
 * Requires authentication via Bearer token in Authorization header.
 * Only allows deleting API keys that belong to the authenticated account.
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
