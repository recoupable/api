import { team } from "@/lib/board/team";

/**
 * Recoup team board receiver.
 *
 * Answers only what Vercel's API sends this deployment: watcher
 * registration and the wake-ups that run its watchers (`POST /api/board/wake`).
 * It serves no other callers; people and agents use the board in Vercel's API.
 */
export const GET = team.fetch;
export const POST = team.fetch;

export const maxDuration = 300;
