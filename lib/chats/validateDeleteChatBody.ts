import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";

export const deleteChatBodySchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

export type DeleteChatBody = z.infer<typeof deleteChatBodySchema>;

export interface ValidatedDeleteChat {
  id: string;
}

/**
 * Validates request for DELETE /api/chats.
 * Parses JSON, validates schema, authenticates, verifies room exists, and checks access.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or validated data if it passes
 */
export async function validateDeleteChatBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedDeleteChat> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = deleteChatBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
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

  const { id } = result.data;

  const accessResult = await validateChatAccess(request, id);
  if (accessResult instanceof NextResponse) {
    return accessResult;
  }

  return { id };
}
