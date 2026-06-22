import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatAccess, type ValidatedChatAccess } from "@/lib/chats/validateChatAccess";

const chatIdSchema = z.string().uuid("id must be a valid UUID");
const accountIdSchema = z.string().uuid("account_id must be a valid UUID");

/**
 * Validates auth and params for GET /api/chats/[id]/messages.
 *
 * Accepts an optional `account_id` (or camelCase `accountId`) query override so a
 * caller with access to multiple accounts can read another account's messages.
 *
 * @param request - Incoming request used to validate chat access.
 * @param id - Chat identifier from route params.
 * @returns NextResponse on failure, or validated chat access data.
 */
export async function validateGetChatMessagesQuery(
  request: NextRequest,
  id: string,
): Promise<NextResponse | ValidatedChatAccess> {
  const parsedId = chatIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        status: "error",
        error: parsedId.error.issues[0]?.message || "Invalid chat ID",
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { searchParams } = new URL(request.url);
  const accountIdParam =
    searchParams.get("account_id") ?? searchParams.get("accountId") ?? undefined;

  if (accountIdParam !== undefined) {
    const parsedAccountId = accountIdSchema.safeParse(accountIdParam);
    if (!parsedAccountId.success) {
      return NextResponse.json(
        {
          status: "error",
          error: parsedAccountId.error.issues[0]?.message || "Invalid account_id",
        },
        { status: 400, headers: getCorsHeaders() },
      );
    }
  }

  return validateChatAccess(request, parsedId.data, { accountId: accountIdParam });
}
