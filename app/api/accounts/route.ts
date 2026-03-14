import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import {
  validateCreateAccountBody,
  type CreateAccountBody,
} from "@/lib/accounts/validateCreateAccountBody";
import {
  validateUpdateAccountBody,
  type UpdateAccountBody,
} from "@/lib/accounts/validateUpdateAccountBody";
import { createAccountHandler } from "@/lib/accounts/createAccountHandler";
import { updateAccountHandler } from "@/lib/accounts/updateAccountHandler";

/**
 * POST /api/accounts
 *
 * Create a new account or retrieve an existing account by email or wallet.
 * If an account with the provided email or wallet exists, returns that account.
 * Otherwise creates a new account and initializes credits.
 *
 * @param req - The incoming request with email and/or wallet in body
 * @returns Account data
 */
export async function POST(req: NextRequest) {
  const body = await safeParseJson(req);

  const validated = validateCreateAccountBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  return createAccountHandler(validated as CreateAccountBody);
}

/**
 * PATCH /api/accounts
 *
 * Update an existing account's profile information.
 * Requires accountId in the body along with fields to update.
 *
 * @param req - The incoming request with accountId and update fields
 * @returns NextResponse with updated account data or error
 */
export async function PATCH(req: NextRequest) {
  const body = await safeParseJson(req);

  const validated = validateUpdateAccountBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  return updateAccountHandler(validated as UpdateAccountBody);
}

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns NextResponse with CORS headers
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
