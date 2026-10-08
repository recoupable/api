import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { getArtists } from "@/lib/artists/getArtists";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";
import { getCatalogOwnerIds } from "@/lib/catalog/getCatalogOwnerIds";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { assertRecipientsAllowed } from "@/lib/emails/assertRecipientsAllowed";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { z } from "zod";

/** Authorize legacy tool references before invoking any business operation. No admin bypass. */
export async function prepareFullOAuthTool(
  name: string,
  input: Record<string, unknown>,
  accountId: string,
) {
  const args = { ...input };
  if (name === "update_task" || name === "delete_task") {
    const id = z.string().parse(args.id);
    const tasks = await selectScheduledActions({ id, account_id: accountId });
    if (!tasks.some(task => task.id === id && task.account_id === accountId))
      throw new Error("Task access denied");
  }
  const artistIds = [args.artistId, args.artist_account_id, args.artist_id].filter(
    (id): id is string => typeof id === "string",
  );
  if (artistIds.length) {
    const accessible = new Set((await getArtists({ accountId })).map(artist => artist.account_id));
    if (artistIds.some(id => !accessible.has(id))) throw new Error("Artist access denied");
  }
  const organizationIds = [args.organizationId, args.organization_id].filter(
    (id): id is string => typeof id === "string",
  );
  if (organizationIds.length) {
    const accessible = new Set(
      (await getAccountOrganizations({ accountId })).map(row => row.organization_id),
    );
    if (organizationIds.some(id => !accessible.has(id))) throw new Error("Workspace access denied");
  }
  if (name === "select_catalog_songs" || name === "insert_catalog_songs") {
    const ids =
      name === "select_catalog_songs"
        ? [z.string().parse(args.catalog_id)]
        : z
            .array(z.object({ catalog_id: z.string() }))
            .parse(args.songs)
            .map(song => song.catalog_id);
    const catalogs = await selectAccountCatalogs(await getCatalogOwnerIds(accountId), {
      catalogIds: ids,
    });
    if (ids.some(id => !catalogs.some(catalog => catalog.id === id)))
      throw new Error("Catalog access denied");
  }
  const roomIds = [
    args.room_id,
    args.active_conversation_id,
    ...(name === "compact_chats" ? z.array(z.string()).parse(args.chat_id) : []),
  ].filter((id): id is string => typeof id === "string");
  for (const id of roomIds) {
    const room = await selectRoom(id);
    // A peer's membership is not consent to copy or email their private conversations.
    if (!room || room.account_id !== accountId) throw new Error("Conversation access denied");
  }
  if (name === "send_email") {
    const to = z.array(z.email()).min(1).parse(args.to);
    const cc = z.array(z.email()).parse(args.cc ?? []);
    if (
      !(typeof args.text === "string" && args.text.trim()) &&
      !(typeof args.html === "string" && args.html.trim())
    )
      throw new Error("Email body required");
    if (!(await assertRecipientsAllowed({ accountId, recipients: [...to, ...cc] })).allowed)
      throw new Error("Recipient access denied");
    // Never allow custom routing headers to bypass recipient validation.
    args.headers = {};
  }
  if (name === "contact_team") {
    const emails = await selectAccountEmails({ accountIds: accountId });
    args.active_account_email = emails[0]?.email ?? "Authenticated Recoup account";
    if (args.active_conversation_id) {
      const room = await selectRoom(String(args.active_conversation_id));
      args.active_conversation_name = room?.topic ?? "Recoup conversation";
    } else delete args.active_conversation_name;
  }
  return args;
}
