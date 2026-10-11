import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetSlackTagOptionsQuery } from "./validateGetSlackTagOptionsQuery";
import { fetchSlackMentions } from "@/lib/admins/slack/fetchSlackMentions";

export interface SlackTagOption {
  id: string;
  name: string;
  avatar: string | null;
}

/**
 * Handler for GET /api/admins/coding-agent/slack-tags
 *
 * Returns the distinct set of Slack users who have ever tagged the Recoup Coding Agent bot.
 * Each entry is a { id, name, avatar } suitable for use as a filter chip in the admin UI.
 *
 * Requires admin authentication.
 *
 * @param request
 */
export async function getSlackTagOptionsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetSlackTagOptionsQuery(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const mentions = await fetchSlackMentions("all");

    const seen = new Set<string>();
    const tags: SlackTagOption[] = [];
    for (const mention of mentions) {
      if (!seen.has(mention.user_id)) {
        seen.add(mention.user_id);
        tags.push({
          id: mention.user_id,
          name: mention.user_name,
          avatar: mention.user_avatar,
        });
      }
    }

    // Sort alphabetically by name
    tags.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      {
        status: "success",
        total: tags.length,
        tags,
      },
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
