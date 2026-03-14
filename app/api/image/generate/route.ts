import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { x402GenerateImage } from "@/lib/x402/recoup/x402GenerateImage";
import { validateGenerateImageQuery } from "@/lib/image/validateGenerateImageQuery";

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
 * Accepts prompt and account_id, and fetches from the x402-protected endpoint.
 *
 * @param request - The request object containing query parameters.
 * @returns {Promise<NextResponse>} JSON response matching the Recoup API format.
 */
export async function GET(request: NextRequest) {
  try {
    const validatedQuery = validateGenerateImageQuery(request);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const { prompt, account_id } = validatedQuery;
    const { searchParams } = new URL(request.url);
    const files = searchParams.get("files");

    const baseUrl = request.nextUrl.origin;
    const data = await x402GenerateImage(prompt, baseUrl, account_id, files);

    return NextResponse.json(data, {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("Error in image generation endpoint:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        error: errorMessage,
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
