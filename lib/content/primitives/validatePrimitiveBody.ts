import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export interface ValidatedPrimitive<T> {
  accountId: string;
  data: T;
}

/**
 * Validates auth and parses the request body against a Zod schema.
 * Shared by all content primitive endpoints.
 *
 * @param request - Incoming Next.js request (body read as JSON).
 * @param schema - Zod schema for the expected JSON body shape.
 * @returns Validated account ID and parsed data, or a NextResponse error.
 */
export async function validatePrimitiveBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
): Promise<NextResponse | ValidatedPrimitive<T>> {
  const body = await safeParseJson(request);
  const result = schema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  return { accountId: authResult.accountId, data: result.data };
}
