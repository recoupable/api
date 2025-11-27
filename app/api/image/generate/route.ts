import { NextRequest, NextResponse } from "next/server";
import generateImage from "@/lib/ai/generateImage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

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
 *
 * @param request - The request object containing query parameters.
 * @returns {Promise<NextResponse>} JSON response with generated image URL or error.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt");

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt query parameter is required" },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    const result = await generateImage(prompt);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to generate image" },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      { ...result },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error generating image:", error);

    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
