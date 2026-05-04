import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const createSessionBodySchema = z.object({
  title: z.string().optional(),
  branch: z.string().optional(),
  cloneUrl: z.string().optional(),
  sandboxType: z.literal("vercel", { message: "Invalid sandbox type" }).optional(),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

/**
 * Validates the request body for `POST /api/sessions`.
 *
 * Repo identity (owner + name) is derived server-side from the
 * authenticated account, not accepted from the body, so this schema
 * stays minimal.
 *
 * @param body - The parsed JSON body (or `{}` for an empty body).
 * @returns The validated body, or a 400 NextResponse describing the first failure.
 */
export function validateCreateSessionBody(body: unknown): NextResponse | CreateSessionBody {
  const result = createSessionBodySchema.safeParse(body);

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

  return result.data;
}
