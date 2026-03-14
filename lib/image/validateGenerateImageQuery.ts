import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const generateImageQuerySchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(1000, "Prompt is too long")
    .describe("Text prompt describing the image to generate"),
  account_id: z
    .string()
    .min(1, "account_id is required")
    .describe("The UUID of the account to generate the image for."),
});

export type GenerateImageQuery = z.infer<typeof generateImageQuerySchema>;

/**
 * Validates generate image query parameters from a NextRequest.
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateGenerateImageQuery(
  request: NextRequest,
): NextResponse | GenerateImageQuery {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = generateImageQuerySchema.safeParse(params);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    const errorCode = firstError.path[0] === "prompt" ? "invalid_prompt" : "invalid_account";

    return NextResponse.json(
      {
        status: "error",
        error: {
          code: errorCode,
          path: firstError.path,
          message: firstError.message,
        },
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return validationResult.data;
}
