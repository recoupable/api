import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "./checkIsAdmin";

/**
 * Handler for GET /api/admins.
 * Returns whether the authenticated account is a Recoup admin.
 *
 * @param request - The request object
 * @returns A NextResponse with { status, isAdmin }
 */
export async function checkAdminHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const isAdmin = await checkIsAdmin(auth.accountId);

    return NextResponse.json(
      {
        status: "success",
        isAdmin,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] checkAdminHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
