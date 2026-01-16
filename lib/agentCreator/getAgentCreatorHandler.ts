import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { ADMIN_EMAILS } from "@/lib/admin";

/**
 * Handler for fetching agent creator information.
 *
 * This is a public endpoint that returns basic creator info (name, image, admin status)
 * for displaying agent creator attribution in the UI.
 *
 * Query parameters:
 * - creatorId: Required - The account ID of the agent creator
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the creator info or an error
 */
export async function getAgentCreatorHandler(request: NextRequest): Promise<NextResponse> {
  const creatorId = request.nextUrl.searchParams.get("creatorId");

  if (!creatorId) {
    return NextResponse.json(
      { message: "Missing creatorId" },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  try {
    const account = await getAccountWithDetails(creatorId);

    if (!account) {
      return NextResponse.json(
        { message: "Creator not found" },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    const email = account.email || null;
    const isAdmin = !!email && ADMIN_EMAILS.includes(email);

    return NextResponse.json(
      {
        creator: {
          name: account.name || null,
          image: account.image || null,
          is_admin: isAdmin,
        },
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json(
      { message },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }
}
