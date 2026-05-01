import { NextRequest, NextResponse } from "next/server";
import generateImage from "@/lib/ai/generateImage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadImageAndCreateMoment } from "@/lib/arweave/uploadImageAndCreateMoment";
import { getBuyerAccount } from "@/lib/x402/getBuyerAccount";
import { parseFilesFromQuery } from "@/lib/files/parseFilesFromQuery";

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
 * GET handler for image generation endpoint (x402 protected).
 *
 * @param request - The request object containing query parameters.
 * @returns {Promise<NextResponse>} JSON response with generated image URL or error.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prompt = searchParams.get("prompt");
    const filesParam = searchParams.get("files");
    const account = getBuyerAccount(request);

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt query parameter is required" },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    // Parse files from query parameter if provided
    let files;
    try {
      files = parseFilesFromQuery(filesParam);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Invalid files parameter.",
          details: error instanceof Error ? error.message : "Format must be: url1:type1|url2:type2",
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    const { image, usage } = await generateImage(prompt, files);

    if (!image) {
      return NextResponse.json(
        { error: "Failed to generate image" },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    const {
      arweaveResult,
      imageUrl,
      moment: momentResult,
      arweaveError,
    } = await uploadImageAndCreateMoment({
      image,
      prompt,
      account,
    });

    return NextResponse.json(
      {
        image,
        usage,
        imageUrl,
        arweaveResult,
        moment: momentResult,
        ...(arweaveError && { arweaveError }),
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error generating image:", error);

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
