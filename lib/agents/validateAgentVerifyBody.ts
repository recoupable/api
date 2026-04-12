import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const agentVerifyBodySchema = z.object({
  email: z.string({ message: "email is required" }).email("email must be a valid email address"),
  code: z.string({ message: "code is required" }).regex(/^\d{6}$/, "code must be a 6-digit number"),
});

export type AgentVerifyBody = z.infer<typeof agentVerifyBodySchema>;

/**
 * Validates request body for POST /api/agents/verify.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body
 */
export function validateAgentVerifyBody(body: unknown): NextResponse | AgentVerifyBody {
  const result = agentVerifyBodySchema.safeParse(body);

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
