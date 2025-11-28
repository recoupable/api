import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { toAccount } from "viem/accounts";
import { getAccount } from "@/lib/coinbase/getAccount";

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

    // Create smart wallet for x402 payments
    const account = await getAccount("0x7AfB9872Ea382B7Eb01c67B6884dD99A744eA64f");

    const fetchWithPayment = wrapFetchWithPayment(fetch, toAccount(account));

    // Build the internal x402 endpoint URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const x402Url = new URL("/api/x402/image/generate", baseUrl);
    x402Url.searchParams.set("prompt", prompt);

    // Make request to x402-protected endpoint (payment handled automatically)
    const response = await fetchWithPayment(x402Url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

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
    console.log("data", data);

    // Decode payment response if present
    const xPaymentResponse = response.headers.get("x-payment-response");
    if (xPaymentResponse) {
      const paymentResponse = decodeXPaymentResponse(xPaymentResponse);
      console.log("Payment response:", paymentResponse);
    }

    // Transform the response to match the Recoup API format
    return NextResponse.json(data, {
      status: 200,
      headers: getCorsHeaders(),
    });
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
