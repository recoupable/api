import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { fetchSlackMentions } from "@/lib/admins/slack/fetchSlackMentions";

interface SlackTagOption {
  id: string;
  name: string;
  avatar: string | null;
}

/** Returns distinct mention authors from the existing collector for admin filter options. */
export async function getSlackTagOptionsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const mentions = await fetchSlackMentions("all");
    const options = new Map<string, SlackTagOption>();
    for (const mention of mentions) {
      if (!options.has(mention.user_id)) {
        options.set(mention.user_id, {
          id: mention.user_id,
          name: mention.user_name,
          avatar: mention.user_avatar,
        });
      }
    }
    const tags = [...options.values()].sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      { status: "success", total: tags.length, tags },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getSlackTagOptionsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
