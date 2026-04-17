import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";

const VALID_LEVELS = ["high", "medium", "low"] as const;
const AXES = ["audience", "genre", "mood", "musicality"] as const;

type Level = (typeof VALID_LEVELS)[number];
type Axis = (typeof AXES)[number];

export type ValidatedGetResearchSimilarRequest = {
  accountId: string;
  artist: string;
  audience: Level;
  genre: Level;
  mood: Level;
  musicality: Level;
  limit?: string;
};

/**
 * Validates `GET /api/research/similar` — auth, `artist`, and the four
 * configuration axes (`audience`, `genre`, `mood`, `musicality`), each
 * defaulting to `medium`. Passes through `limit` as a raw string if present.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchSimilarRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchSimilarRequest> {
  const { searchParams } = new URL(request.url);
  const axes: Record<Axis, Level> = {
    audience: "medium",
    genre: "medium",
    mood: "medium",
    musicality: "medium",
  };

  for (const axis of AXES) {
    const raw = searchParams.get(axis);
    if (raw == null) continue;
    if (!VALID_LEVELS.includes(raw as Level)) {
      return errorResponse(`Invalid ${axis}. Must be one of: ${VALID_LEVELS.join(", ")}`, 400);
    }
    axes[axis] = raw as Level;
  }

  const validated = await validateArtistRequest(request);
  if (validated instanceof NextResponse) return validated;

  return { ...validated, ...axes, limit: searchParams.get("limit") ?? undefined };
}
