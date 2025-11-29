import { NextRequest, NextResponse } from "next/server";
import generateImage from "@/lib/ai/generateImage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import uploadImageToArweave from "@/lib/arweave/uploadImageToArweave";
import { getFetchableUrl } from "@/lib/arweave/getFetchableUrl";
import { createImageMoment } from "@/lib/inprocess/createImageMoment";
import { getBuyerAccount } from "@/lib/x402/getBuyerAccount";

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
    const arweaveResult = await uploadImageToArweave({
      base64Data: result.images[0].base64,
      mimeType: result.images[0].mediaType,
    });

    const arweaveUri = `ar://${arweaveResult.id}`;
    const imageUrl = getFetchableUrl(arweaveUri);

    const momentResult = await createImageMoment({
      prompt,
      account,
      arweaveUri,
      mediaType: result.images[0].mediaType,
    });

    return NextResponse.json(
      {
        ...result,
        imageUrl,
        arweaveResult,
        moment: momentResult,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(error, {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}
