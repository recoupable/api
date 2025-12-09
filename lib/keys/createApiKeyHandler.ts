import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateApiKeyBody } from "@/lib/keys/validateCreateApiKeyBody";
import { generateApiKey } from "@/lib/keys/generateApiKey";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";
import { PRIVY_PROJECT_SECRET } from "../const";

/**
 * Handler for creating a new API key.
 *
 * Body parameters:
 * - key_name (required): The name for the API key
 * - account_id (required): The account ID to associate the key with
 *
 * @param request - The request object containing the body with key_name and account_id.
 * @returns A NextResponse with the generated API key.
 */
export async function createApiKeyHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const validatedBody = validateCreateApiKeyBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const { key_name, account_id } = validatedBody;

    const rawApiKey = generateApiKey("recoup_sk");
    const keyHash = hashApiKey(rawApiKey, PRIVY_PROJECT_SECRET);

    const { error } = await insertApiKey({
      name: key_name.trim(),
      account: account_id,
      key_hash: keyHash,
    });

    if (error) {
      console.error("Error inserting API key:", error);
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to store API key",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        key: rawApiKey,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] Error creating API key:", error);
    const message = error instanceof Error ? error.message : "Failed to create an API key";
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
