import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const sandboxBodySchema = z.object({
  prompt: z.string({ message: "prompt is required" }).min(1, "prompt cannot be empty"),
});

export type SandboxBody = z.infer<typeof sandboxBodySchema>;

/**
 * Validates request body for POST /api/sandbox.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateSandboxBody(body: unknown): NextResponse | SandboxBody {
  const result = sandboxBodySchema.safeParse(body);

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
