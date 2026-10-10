import { authorizeSiteWorkspace } from "@/lib/sites/authorizeSiteWorkspace";
import { limitSiteRequest } from "@/lib/sites/activity/limitSiteRequest";
import { selectWorkspacePlayerFans } from "@/lib/supabase/player_fan_contacts/selectWorkspacePlayerFans";
import { validateWorkspacePlayerFansQuery } from "./validateWorkspacePlayerFansQuery";
export async function readWorkspacePlayerFans(accountId: string, input: unknown) {
  const value = validateWorkspacePlayerFansQuery(input);
  const owner = await authorizeSiteWorkspace(accountId, value.organizationId);
  await limitSiteRequest(owner, "player-private-report", 120);
  const fans = await selectWorkspacePlayerFans(owner, value.offset, value.limit);
  return {
    fans,
    scope: "workspace",
    marketingConsent: false,
    offset: value.offset,
    limit: value.limit,
    nextOffset: fans.length === value.limit ? value.offset + value.limit : null,
  };
}
