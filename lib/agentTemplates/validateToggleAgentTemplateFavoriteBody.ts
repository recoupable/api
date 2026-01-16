import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const toggleAgentTemplateFavoriteBodySchema = z.object({
  templateId: z.string({
    error: "templateId is required",
  }).min(1, "templateId is required"),
  isFavourite: z.boolean({
    error: "isFavourite is required",
  }),
});

export type ToggleAgentTemplateFavoriteBody = z.infer<
  typeof toggleAgentTemplateFavoriteBodySchema
>;

/**
 * Validates request body for POST /api/agent-templates/favorites.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateToggleAgentTemplateFavoriteBody(
  body: unknown,
): NextResponse | ToggleAgentTemplateFavoriteBody {
  const result = toggleAgentTemplateFavoriteBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        message: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
