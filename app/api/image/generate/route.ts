import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { x402GenerateImage } from "@/lib/x402/recoup/x402GenerateImage";
import { z } from "zod";

const queryParamsSchema = z.object({
  prompt: z.string().min(1, "The provided prompt is invalid or empty"),
  artist_account_id: z.string().min(1, "The provided artist_account_id is invalid or not found"),
});

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET handler for image generation endpoint.
 * Accepts prompt and artist_account_id, and fetches from the x402-protected endpoint.
 *
 * @param request - The request object containing query parameters.
 * @returns {Promise<NextResponse>} JSON response matching the Recoup API format.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    // Validate query parameters with Zod
    const validationResult = queryParamsSchema.safeParse(params);
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

    const { prompt } = validationResult.data;

    const baseUrl = request.nextUrl.origin;
    const data = await x402GenerateImage(prompt, baseUrl);

    return NextResponse.json(data, {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("Error in image generation endpoint:", error);
    return NextResponse.json(error, {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}
