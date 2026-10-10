import { exchangePlayerSpotify } from "@/lib/players/exchangePlayerSpotify";
import { publicPlayerResponse } from "@/lib/players/publicPlayerResponse";
/**
 * PKCE exchange and provider-verified artist fan capture.
 *
 * @param request - Incoming HTTP request.
 * @returns HTTP response.
 */
export async function POST(request: Request) {
  return publicPlayerResponse(
    request,
    async () => exchangePlayerSpotify(await request.json().catch(() => null)),
    true,
  );
}
