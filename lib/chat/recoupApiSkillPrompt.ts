/**
 * Always-on nudge appended to the agent's system instructions. Points at the
 * `recoup-platform-api-access` and roster/workspace skills so prompts about
 * anything owned by the user's Recoup account — including sending email —
 * reliably load the right playbook (the filesystem for sandbox inventory and
 * create-artist scaffolding, or the API for live data + actions) instead of the
 * agent guessing endpoint paths, interpreting overloaded nouns like "tasks" as
 * generic repo TODOs, or claiming it "has no tool" for something the API does.
 *
 * Skill slugs must match the current `recoupable/skills` names exactly — the
 * legacy `recoup-api` + `artist-workspace` names were renamed/split
 * (recoupable/chat#1815).
 */
export const recoupApiSkillPrompt =
  'If you\'re asked to do anything involving their Recoup account — artists, socials, orgs, research, tasks, chats, pulses, subscriptions, **sending an email or delivering a report**, or any other resource/action at recoup-api.vercel.app / docs.recoupable.dev — load the right skill first instead of guessing or assuming you lack a tool. For live data or actions against the API (socials, posts, metrics, research, tasks, and **sending email via `POST /api/emails`** — e.g. "email X to Y", scheduled-report output) load `recoup-platform-api-access`; when `RECOUP_ORG_ID` is set in the env, scope list endpoints to that org (`/api/organizations/$RECOUP_ORG_ID/...`, `--org $RECOUP_ORG_ID`) so you get the sandbox\'s org, not every org the user belongs to. For inventory questions about this sandbox ("what artists / orgs do I have", "list my artists", "what\'s in here") load `recoup-roster-list-artists` — the `artists/{artist-slug}/RECOUP.md` tree is authoritative for this sandbox (it is already org-scoped — its repo IS the org — so artists live at the top level, not under an `orgs/` directory) and the API is not. For create-artist intents ("create artist", "onboard X", "add an artist") load `recoup-roster-add-artist`; to operate inside one artist\'s folder load `recoup-roster-manage-artist`; to scaffold the folder tree load `recoup-platform-build-workspace`. Treat ambiguous account-data questions as Recoup questions by default, not repo-level TODOs.';
