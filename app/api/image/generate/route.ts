import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

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
    const prompt = searchParams.get("prompt");
    const artistAccountId = searchParams.get("artist_account_id");

    if (!prompt) {
      return NextResponse.json(
        {
          status: "error",
          error: {
            code: "invalid_prompt",
            message: "The provided prompt is invalid or empty",
          },
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    if (!artistAccountId) {
      return NextResponse.json(
        {
          status: "error",
          error: {
            code: "invalid_artist",
            message: "The provided artist_account_id is invalid or not found",
          },
        },
        {
          status: 400,
          headers: getCorsHeaders(),
        },
      );
    }

    // Build the internal x402 endpoint URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const x402Url = new URL("/api/x402/image/generate", baseUrl);
    x402Url.searchParams.set("prompt", prompt);

    // Forward the X-PAYMENT header if present (for x402 payment)
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    const xPaymentHeader = request.headers.get("X-PAYMENT");
    if (xPaymentHeader) {
      headers["X-PAYMENT"] = xPaymentHeader;
    }

    // Make request to x402-protected endpoint
    const response = await fetch(x402Url.toString(), {
      method: "GET",
      headers,
    });

    // Handle x402 payment required response
    if (response.status === 402) {
      const paymentData = await response.json();
      return NextResponse.json(
        {
          status: "error",
          error: {
            code: "payment_required",
            message: "Payment required to generate image",
          },
          paymentRequirements: paymentData,
        },
        {
          status: 402,
          headers: getCorsHeaders(),
        },
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: "Failed to generate image",
      }));

      return NextResponse.json(
        {
          status: "error",
          error: {
            code: "generation_failed",
            message: errorData.error || "The image generation process failed",
          },
        },
        {
          status: response.status,
          headers: getCorsHeaders(),
        },
      );
    }

    const data = await response.json();

    // Transform the response to match the Recoup API format
    return NextResponse.json(
      {
        status: "success",
        data: {
          image_url: data.imageUrl || null,
          post_id: null, // TODO: Implement post creation if needed
          artist_id: artistAccountId,
          created_at: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error in image generation endpoint:", error);

    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      {
        status: "error",
        error: {
          code: "generation_failed",
          message: errorMessage,
        },
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
