import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccount } from "@/lib/supabase/accounts/selectAccount";
import { selectRunningAgentStatus } from "@/lib/supabase/agent_status/selectRunningAgentStatus";

interface GetRunningAgentParams {
  artistId: string;
}

/**
 * Handler for GET /api/get_running_agent
 *
 * Looks up the artist's social accounts, then finds the most recent
 * non-terminal agent status entry.
 */
export async function getRunningAgentHandler({
  artistId,
}: GetRunningAgentParams): Promise<NextResponse> {
  if (!artistId) {
    return NextResponse.json(
      { message: "artistId is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  try {
    const account = await selectAccount(artistId);

    if (!account) {
      return NextResponse.json(
        { agent: null },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    const socialIds = (account.account_socials as any[]).map(
      (s: any) => s.social_id as string,
    );

    const agentStatus = await selectRunningAgentStatus(socialIds);

    return NextResponse.json(
      { agent: agentStatus },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ message }, { status: 400, headers: getCorsHeaders() });
  }
}
