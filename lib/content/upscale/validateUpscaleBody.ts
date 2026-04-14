import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const createUpscaleBodySchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video"]),
  upscale_factor: z.number().min(1).max(4).optional().default(2),
  target_resolution: z.enum(["720p", "1080p", "1440p", "2160p"]).optional(),
});

export type ValidatedUpscaleBody = { accountId: string } & z.infer<typeof createUpscaleBodySchema>;

/**
 * Validate Upscale Body.
 *
 * @param request - Incoming HTTP request.
 * @returns - Computed result.
 */
export async function validateUpscaleBody(
  request: NextRequest,
): Promise<NextResponse | ValidatedUpscaleBody> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await safeParseJson(request);
  const result = createUpscaleBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", field: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: authResult.accountId, ...result.data };
}
