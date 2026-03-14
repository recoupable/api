import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { generateApiKey } from "@/lib/keys/generateApiKey";
import { hashApiKey } from "@/lib/keys/hashApiKey";
import { insertApiKey } from "@/lib/supabase/account_api_keys/insertApiKey";
import { PRIVY_PROJECT_SECRET } from "@/lib/const";

/**
 * Core helper to create and store an API key for a given owner (account or organization).
 * Handles key generation, hashing, insertion, and response formatting.
 *
 * @param ownerId - The account or organization ID that owns the key
 * @param keyName - The display name for the key
 * @returns NextResponse with the generated key or an error response
 */
export async function createKey(ownerId: string, keyName: string): Promise<NextResponse> {
  const rawApiKey = generateApiKey("recoup_sk");
  const keyHash = hashApiKey(rawApiKey, PRIVY_PROJECT_SECRET);

  const { error } = await insertApiKey({
    name: keyName.trim(),
    account: ownerId,
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
}
