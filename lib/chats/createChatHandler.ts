import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { insertRoom } from "@/lib/supabase/rooms/insertRoom";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { validateCreateChatBody } from "@/lib/chats/validateCreateChatBody";
import { safeParseJson } from "@/lib/networking/safeParseJson";

/**
 * Handler for creating a new chat room.
 *
 * Requires authentication via x-api-key header.
 * The account ID is inferred from the API key, unless an accountId is provided
 * in the request body by an organization API key with access to that account.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the created chat or an error
 */
export async function createChatHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }

    let accountId = accountIdOrError;

    const body = await safeParseJson(request);

    const validated = validateCreateChatBody(body);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { artistId, chatId, accountId: bodyAccountId } = validated;

    // Handle accountId override for org API keys
    if (bodyAccountId) {
      const apiKey = request.headers.get("x-api-key");
      if (!apiKey) {
        return NextResponse.json(
          {
            status: "error",
            message: "Failed to validate API key",
          },
          {
            status: 500,
            headers: getCorsHeaders(),
          },
        );
      }

      const keyDetails = await getApiKeyDetails(apiKey);
      if (!keyDetails) {
        return NextResponse.json(
          {
            status: "error",
            message: "Failed to validate API key",
          },
          {
            status: 500,
            headers: getCorsHeaders(),
          },
        );
      }

      const hasAccess = await canAccessAccount({
        orgId: keyDetails.orgId,
        targetAccountId: bodyAccountId,
      });

      if (!hasAccess) {
        return NextResponse.json(
          {
            status: "error",
            message: "Access denied to specified accountId",
          },
          {
            status: 403,
            headers: getCorsHeaders(),
          },
        );
      }

      accountId = bodyAccountId;
    }

    const roomId = chatId || generateUUID();

    const chat = await insertRoom({
      id: roomId,
      account_id: accountId,
      artist_id: artistId || null,
      topic: null,
    });

    return NextResponse.json(
      {
        status: "success",
        chat,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] createChatHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to create chat",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
