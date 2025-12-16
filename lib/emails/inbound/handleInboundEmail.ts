import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Handles inbound email webhook events.
 * Logs the raw event and returns it when the type is "email.received".
 *
 * @param request - The NextRequest object
 * @returns A NextResponse object
 */
export async function handleInboundEmail(request: NextRequest): Promise<NextResponse> {
  const event = await request.json();

  console.log("Received email event:", event);

  if (event?.type === "email.received") {
    return NextResponse.json(event);
  }

  return NextResponse.json({});
}
