import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";

/**
 * Retrieves tasks (scheduled actions) from the database.
 * Supports filtering by id, account_id, or artist_account_id.
 * If an `id` is provided, returns a single task matching that ID.
 * Otherwise, returns an array of all tasks (optionally filtered).
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with tasks data.
 */
export async function getTasksHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const account_id = searchParams.get("account_id");
    const artist_account_id = searchParams.get("artist_account_id");

    const tasks = await selectScheduledActions({
      id: id && typeof id === "string" ? id : undefined,
      account_id: account_id && typeof account_id === "string" ? account_id : undefined,
      artist_account_id:
        artist_account_id && typeof artist_account_id === "string" ? artist_account_id : undefined,
    });

    return NextResponse.json(
      {
        status: "success",
        tasks,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
