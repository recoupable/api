import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { getChartmetricToken } from "@/lib/chartmetric/getChartmetricToken";

/**
 * Proxy handler for Chartmetric API requests.
 *
 * Authenticates the caller, deducts 5 credits, then forwards the request
 * to the Chartmetric API using a server-side access token.
 *
 * Credit cost rationale: Chartmetric costs $350/month for API access. At 5 credits
 * ($0.05) per call, we break even at ~7,000 calls/month (~233/day). A typical
 * research task (6–7 API calls) costs 30–35 credits ($0.30–$0.35).
 *
 * @param request - The incoming NextRequest.
 * @param params - Route params containing the Chartmetric path segments.
 * @param params.path - Array of path segments to forward to the Chartmetric API.
 * @returns The Chartmetric API response forwarded as JSON.
 */
export async function proxyChartmetricRequest(
  request: NextRequest,
  params: { path: string[] },
): Promise<NextResponse> {
  // 1. Authenticate
  const authResult = await validateAuthContext(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId } = authResult;

  // 2. Deduct 5 credits per Chartmetric API call
  try {
    await deductCredits({ accountId, creditsToDeduct: 5 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.toLowerCase().includes("insufficient credits")) {
      return NextResponse.json(
        { status: "error", error: "Insufficient credits for Chartmetric API call" },
        { status: 402, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(
      { status: "error", error: "Failed to deduct credits" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  // 3. Get Chartmetric access token
  let accessToken: string;
  try {
    accessToken = await getChartmetricToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { status: "error", error: `Failed to obtain Chartmetric token: ${message}` },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  // 4. Build the Chartmetric URL, preserving query params
  const pathSegments = params.path.join("/");
  const originalUrl = new URL(request.url);
  const chartmetricUrl = `https://api.chartmetric.com/api/${pathSegments}${originalUrl.search}`;

  // 5. Read the request body for non-GET methods
  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text();
    } catch {
      // If body reading fails, proceed without a body
    }
  }

  // 6. Forward the request to Chartmetric
  try {
    const chartmetricResponse = await fetch(chartmetricUrl, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body } : {}),
    });

    const data = await chartmetricResponse.json();

    return NextResponse.json(data, {
      status: chartmetricResponse.status,
      headers: getCorsHeaders(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { status: "error", error: `Chartmetric API request failed: ${message}` },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
