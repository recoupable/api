import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

const codingAgentPRSchema = z.object({
  repo: z.string(),
  number: z.number(),
  url: z.string(),
  baseBranch: z.string(),
});

export const codingAgentCallbackSchema = z.object({
  threadId: z.string({ message: "threadId is required" }).min(1, "threadId cannot be empty"),
  status: z.enum(["pr_created", "no_changes", "failed", "updated"]),
  branch: z.string().optional(),
  snapshotId: z.string().optional(),
  prs: z.array(codingAgentPRSchema).optional(),
  message: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});

export type CodingAgentCallbackBody = z.infer<typeof codingAgentCallbackSchema>;

/**
 * Validates the coding agent callback body against the expected schema.
 *
 * @param body - The parsed JSON body of the callback request.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateCodingAgentCallback(body: unknown): NextResponse | CodingAgentCallbackBody {
  const result = codingAgentCallbackSchema.safeParse(body);

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
