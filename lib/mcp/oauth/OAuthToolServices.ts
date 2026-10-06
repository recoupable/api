export type OAuthToolServices = {
  listArtists: (accountId: string) => Promise<unknown>;
  createArtist: (accountId: string, name: string) => Promise<unknown>;
  updateArtist: (
    accountId: string,
    artistId: string,
    updates: { name?: string; image?: string; instruction?: string },
  ) => Promise<unknown>;
  getSocials: (accountId: string, artistId: string) => Promise<unknown>;
  getChats: (accountId: string) => Promise<unknown>;
};
