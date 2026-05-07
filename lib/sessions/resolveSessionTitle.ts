import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { getRandomCityName } from "@/lib/sessions/getRandomCityName";

interface ResolveSessionTitleInput {
  providedTitle?: string;
  accountId: string;
}

/**
 * Resolves the final title for a new session.
 *
 * If the caller provided a non-blank title, returns it trimmed.
 * Otherwise queries the account's existing session titles and picks
 * a random city name that doesn't collide with them — mirroring the
 * open-agents fallback so generated titles look familiar after
 * frontend cutover.
 *
 * @param input - Provided title (optional) and the owning account id.
 * @returns The resolved title.
 */
export async function resolveSessionTitle(input: ResolveSessionTitleInput): Promise<string> {
  const trimmed = input.providedTitle?.trim();
  if (trimmed) {
    return trimmed;
  }

  const rows = await selectSessions({ accountId: input.accountId });
  const usedTitles = rows.map(row => row.title);
  return getRandomCityName(new Set(usedTitles));
}
