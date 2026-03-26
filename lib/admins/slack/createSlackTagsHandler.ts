import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import type { BotTag } from "./fetchBotMentions";

interface SlackTagsHandlerConfig {
  validate: (request: NextRequest) => Promise<NextResponse | { period: AdminPeriod }>;
  fetchMentions: (period: AdminPeriod) => Promise<BotTag[]>;
  responseField: string;
  totalField: string;
  countField: string;
}

/**
 * Factory that creates a handler for admin slack tags endpoints.
 * Parameterized by validation, fetching, and response field naming.
 *
 * @param config
 */
export function createSlackTagsHandler(
  config: SlackTagsHandlerConfig,
): (request: NextRequest) => Promise<NextResponse> {
  const { validate, fetchMentions, responseField, totalField, countField } = config;

  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const query = await validate(request);
      if (query instanceof NextResponse) {
        return query;
      }

      const tags = await fetchMentions(query.period);
      const totalResponses = tags.reduce((sum, tag) => sum + tag.responses.length, 0);
      const tagsWithResponses = tags.filter(tag => tag.responses.length > 0).length;

      return NextResponse.json(
        {
          status: "success",
          total: tags.length,
          [totalField]: totalResponses,
          [countField]: tagsWithResponses,
          tags,
        },
        { status: 200, headers: getCorsHeaders() },
      );
    } catch (error) {
      console.error(`[ERROR] slackTagsHandler (${responseField}):`, error);
      return NextResponse.json(
        { status: "error", message: "Internal server error" },
        { status: 500, headers: getCorsHeaders() },
      );
    }
  };
}
