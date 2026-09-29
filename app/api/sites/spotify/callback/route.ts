import { NextRequest } from "next/server";
import { finishFanConnection } from "@/lib/sites/fanConnection/finishFanConnection";
/**
 * Complete Spotify authorization and atomically attribute the fan to the site.
 *
 * @param request - HTTP request.
 * @returns HTTP response.
 */
export async function GET(request: NextRequest) {
  return finishFanConnection(request);
}
