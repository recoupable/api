import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const createLipsyncBodySchema = z.strictObject({
  prompt: z.string().min(1).max(50000),
  image_url: z.string().url(),
  audio_url: z.string().url(),
  duration: z.number().int().min(5).max(19),
  seed: z.number().int().optional(),
});

export type ValidatedCreateLipsyncBody = { accountId: string } & z.infer<
  typeof createLipsyncBodySchema
>;

/** Validate a bounded audio-driven request before credits or provider work. */
export async function validateCreateLipsyncBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedCreateLipsyncBody> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = createLipsyncBodySchema.safeParse(await safeParseJson(request));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { status: "error", field: issue.path, error: issue.message },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }
  return { accountId: auth.accountId, ...parsed.data };
}
