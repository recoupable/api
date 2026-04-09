import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";

/**
 * Parses and validates the request body against a Zod schema.
 * Shared by all content primitive endpoints.
 * Auth is handled separately by each handler via validateAuthContext.
 *
 * @param request - Incoming Next.js request (body read as JSON).
 * @param schema - Zod schema for the expected JSON body shape.
 * @returns Validated parsed data, or a NextResponse error.
 */
export async function validatePrimitiveBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>,
): Promise<NextResponse | T> {
  const body = await safeParseJson(request);
  const result = schema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
