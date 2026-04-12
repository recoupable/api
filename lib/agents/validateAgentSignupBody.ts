import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";

export const agentSignupBodySchema = z.object({
  email: z.string({ message: "email is required" }).email("email must be a valid email address"),
});

export type AgentSignupBody = z.infer<typeof agentSignupBodySchema>;

/**
 * Validates POST /api/agents/signup. Parses the request body, runs the
 * zod schema check, and returns either the validated body or a 400
 * NextResponse describing the first failure. The handler does not need
 * to know about JSON parsing or zod — it just receives the typed body.
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse with an error if validation fails, or the validated body
 */
export async function validateAgentSignupBody(
  request: NextRequest,
): Promise<NextResponse | AgentSignupBody> {
  const body = await safeParseJson(request);
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
