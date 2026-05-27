import { NextRequest, NextResponse } from "next/server";
import generateImage from "@/lib/ai/generateImage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { createImageMoment } from "@/lib/inprocess/createImageMoment";
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

    let imageUrl: string | null = null;
    let momentResult: unknown | null = null;
    let uploadError: string | null = null;
    try {
      const { url } = await uploadPublicAsset({
        data: Buffer.from(image.base64, "base64"),
        contentType: image.mediaType,
      });
      imageUrl = url;

      if (account) {
        try {
          momentResult = await createImageMoment({
            prompt,
            account,
            imageUri: imageUrl,
            mediaType: image.mediaType,
          });
        } catch (momentError) {
          console.error("Error creating moment:", momentError);
        }
      }
    } catch (e) {
      console.error("Error uploading image:", e);
      uploadError = "Failed to upload generated image";
    }

    return NextResponse.json(
      {
        image,
        usage,
        imageUrl,
        moment: momentResult,
        ...(uploadError && { uploadError }),
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error generating image:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
