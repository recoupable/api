import { selectOAuthPersonalArtists } from "../../supabase/account_artist_ids/selectOAuthPersonalArtists";
import { createArtistInDb } from "../../artists/createArtistInDb";
import { updateAccount } from "../../supabase/accounts/updateAccount";
import { updateAccountInfo } from "../../supabase/account_info/updateAccountInfo";
import { getArtistSocials } from "../../artist/getArtistSocials";
import { selectChatsWithSessions } from "../../supabase/chats/selectChatsWithSessions";
import type { OAuthToolServices } from "./OAuthToolServices";

/** Account-bound adapters over existing domain operations; no model-supplied owner overrides. */
export function createOAuthToolServices(): OAuthToolServices {
  const assertArtist = async (accountId: string, artistId: string) => {
    if (!(await selectOAuthPersonalArtists(accountId)).some(artist => artist.id === artistId))
      throw new Error("Artist access denied");
  };
  return {
    listArtists: async accountId => ({ artists: await selectOAuthPersonalArtists(accountId) }),
    createArtist: async (accountId, name) => {
      const artist = await createArtistInDb(name, accountId);
      if (!artist) throw new Error("Artist creation failed");
      return { artist: { id: artist.account_id, name: artist.name } };
    },
    updateArtist: async (accountId, artistId, updates) => {
      await assertArtist(accountId, artistId);
      if (updates.name !== undefined && !(await updateAccount(artistId, { name: updates.name })))
        throw new Error("Artist update failed");
      const info = {
        ...(updates.image !== undefined ? { image: updates.image } : {}),
        ...(updates.instruction !== undefined ? { instruction: updates.instruction } : {}),
      };
      if (Object.keys(info).length && !(await updateAccountInfo(artistId, info)))
        throw new Error("Artist update failed");
      return { updated: true, artistId };
    },
    getSocials: async (accountId, artistId) => {
      await assertArtist(accountId, artistId);
      const result = await getArtistSocials({ artist_account_id: artistId, page: 1, limit: 100 });
      if (result.status !== "success") throw new Error("Social profiles unavailable");
      return result;
    },
    getChats: async accountId => {
      const rows = await selectChatsWithSessions({ accountIds: [accountId] });
      if (!rows) throw new Error("Chats unavailable");
      // Personal consent must not disclose conversations in an organization-managed artist context.
      const artists = new Set(
        (await selectOAuthPersonalArtists(accountId)).map(artist => artist.id),
      );
      return {
        chats: rows.flatMap(row =>
          row.session && (!row.session.artist_id || artists.has(row.session.artist_id))
            ? [
                {
                  id: row.id,
                  title: row.title,
                  sessionId: row.session_id,
                  artistId: row.session.artist_id,
                },
              ]
            : [],
        ),
      };
    },
  };
}
