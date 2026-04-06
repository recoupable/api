import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const agentSignupBodySchema = z.object({
  email: z.string({ message: "email is required" }).email("email must be a valid email address"),
});

export type AgentSignupBody = z.infer<typeof agentSignupBodySchema>;

/**
 * Validates request body for POST /api/agents/signup.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body
 */
export function validateAgentSignupBody(body: unknown): NextResponse | AgentSignupBody {
  const result = agentSignupBodySchema.safeParse(body);

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
