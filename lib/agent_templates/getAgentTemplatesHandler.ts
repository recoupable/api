import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAgentTemplatesForAccount } from "@/lib/supabase/agent_templates/getAgentTemplatesForAccount";

/**
 * `GET /api/agent-templates` — authenticated list of templates for the caller's account.
 */
export async function getAgentTemplatesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const templates = await getAgentTemplatesForAccount(auth.accountId);

    return NextResponse.json(templates, {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[ERROR] getAgentTemplatesHandler:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
