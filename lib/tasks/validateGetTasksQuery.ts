import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";
import { z } from "zod";

export const getTasksQuerySchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Optional: Filter tasks by the account ID which created them."),
  artist_account_id: z
    .string()
    .optional()
    .describe("Optional: Filter tasks by the artist account ID."),
  enabled: z.coerce.boolean().optional().describe("Optional: Filter tasks by their enabled status"),
  id: z.string().optional().describe("Optional: Filter tasks by task ID"),
});

export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;
export type ValidatedGetTasksQuery = Omit<GetTasksQuery, "account_id"> & { account_id: string };

/**
 * Validates get tasks query parameters from a NextRequest.
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with an error if validation/auth fails, or validated and authorized query params.
 */
export async function validateGetTasksQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetTasksQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = getTasksQuerySchema.safeParse(params);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  let targetAccountId = authResult.accountId;

  if (validationResult.data.account_id && validationResult.data.account_id !== authResult.accountId) {
    const isAdmin = await checkIsAdmin(authResult.accountId);
    if (isAdmin) {
      targetAccountId = validationResult.data.account_id;
    } else {
      const overrideResult = await validateAccountIdOverride({
        currentAccountId: authResult.accountId,
        targetAccountId: validationResult.data.account_id,
      });

      if (overrideResult instanceof NextResponse) {
        return overrideResult;
      }

      targetAccountId = overrideResult.accountId;
    }
  }

  return {
    ...validationResult.data,
    account_id: targetAccountId,
  };
}
