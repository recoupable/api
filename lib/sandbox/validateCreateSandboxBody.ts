import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { parseGitHubRepoUrl } from "@/lib/github/parseGitHubRepoUrl";

export const createSandboxBodySchema = z.object({
  repoUrl: z
    .string({ message: "repoUrl is required" })
    .min(1, "repoUrl cannot be empty")
    .refine(value => parseGitHubRepoUrl(value) !== null, {
      message: "repoUrl must be a valid GitHub repository URL",
    }),
  sessionId: z.string().optional(),
  branch: z.string().optional(),
});

export type CreateSandboxBody = z.infer<typeof createSandboxBodySchema>;

export interface ValidatedCreateSandboxRequest {
  body: CreateSandboxBody;
  auth: AuthContext;
}

/**
 * Validates a `POST /api/sandbox` request: authenticates the caller,
 * tolerates malformed JSON (treated as an empty body), then enforces
 * the Zod schema (including a strict GitHub URL check). Returns either
 * the first 4xx response or the validated `{ body, auth }`.
 */
export async function validateCreateSandboxBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateSandboxRequest> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const rawBody = await safeParseJson(request);
  const result = createSandboxBodySchema.safeParse(rawBody);
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

  return { body: result.data, auth };
}
