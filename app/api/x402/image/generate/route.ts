import { NextRequest, NextResponse } from "next/server";
import generateImage from "@/lib/ai/generateImage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadImageAndCreateMoment } from "@/lib/arweave/uploadImageAndCreateMoment";
import { getBuyerAccount } from "@/lib/x402/getBuyerAccount";
import type { FilePart } from "ai";

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
    // Format: files=url1:type1|url2:type2
    // Example: files=https://example.com/image.png:image/png|https://example.com/file.jpg:image/jpeg
    // Note: Split on last ":" since URLs contain colons (e.g., https://)
    let files: FilePart[] | undefined;
    if (filesParam) {
      try {
        const fileEntries = filesParam.split("|");
        files = fileEntries
          .map(entry => {
            // Split on last ":" to handle URLs with colons (e.g., https://)
            const lastColonIndex = entry.lastIndexOf(":");
            if (lastColonIndex === -1) {
              throw new Error(`Invalid file entry: "${entry}". Format must be "url:mediaType"`);
            }
            const data = entry.substring(0, lastColonIndex).trim();
            const mediaType = entry.substring(lastColonIndex + 1).trim();
            if (!data || !mediaType) {
              throw new Error(`Invalid file entry: "${entry}". Format must be "url:mediaType"`);
            }
            return {
              type: "file" as const,
              data: decodeURIComponent(data),
              mediaType: mediaType,
            };
          })
          .filter(file => file.data && file.mediaType);
      } catch (error) {
        return NextResponse.json(
          {
            error: "Invalid files parameter.",
            details:
              error instanceof Error ? error.message : "Format must be: url1:type1|url2:type2",
          },
          {
            status: 400,
            headers: getCorsHeaders(),
          },
        );
      }
    }
    console.log("files", files);

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
