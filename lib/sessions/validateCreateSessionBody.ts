import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { isValidGitHubRepoOwner } from "@/lib/github/isValidGitHubRepoOwner";
import { isValidGitHubRepoName } from "@/lib/github/isValidGitHubRepoName";

export const createSessionBodySchema = z.object({
  title: z.string().optional(),
  repoOwner: z
    .string()
    .refine(isValidGitHubRepoOwner, { message: "Invalid repository owner" })
    .optional(),
  repoName: z
    .string()
    .refine(isValidGitHubRepoName, { message: "Invalid repository name" })
    .optional(),
  branch: z.string().optional(),
  cloneUrl: z.string().optional(),
  sandboxType: z.literal("vercel", { message: "Invalid sandbox type" }).optional(),
});

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

/**
 * Validates the request body for `POST /api/sessions`.
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
