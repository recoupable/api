/**
 * Curated cast of Recoup house artists featured in the welcome email, with
 * stable Spotify CDN art (`i.scdn.co` URLs never expire, unlike the signed
 * Instagram/TikTok avatar URLs). PFPs and album covers were resolved from each
 * artist's linked Spotify profile (authoritative artist id, not name search).
 *
 * These are deliberately hard-coded: the welcome email is the same for every
 * signup, so a fixed curated set keeps the send deterministic with no per-send
 * DB or Spotify lookup.
 */
export type WelcomeArtist = {
  name: string;
  /** Spotify artist image (640px), used as the circular PFP. */
  pfpUrl: string;
  /** A representative album cover (300px) from the artist's catalog. */
  albumCoverUrl: string;
  albumName: string;
};

export const WELCOME_EMAIL_CAST: WelcomeArtist[] = [
  {
    name: "Gatsby Grace",
    pfpUrl: "https://i.scdn.co/image/ab6761610000e5eb5fd8fa1d768bbc789e903a3f",
    albumCoverUrl: "https://i.scdn.co/image/ab67616d00001e0292639b99a324cfab10703697",
    albumName: "Beautiful Tomorrow",
  },
  {
    name: "LA EQUIS",
    pfpUrl: "https://i.scdn.co/image/ab6761610000e5eb8df3365689c6ee50ba46e700",
    albumCoverUrl: "https://i.scdn.co/image/ab67616d00001e02c5e86ce5be917714de1bbe58",
    albumName: "El Nino Maravilla",
  },
  {
    name: "Sound of Fractures",
    pfpUrl: "https://i.scdn.co/image/ab6761610000e5eb5bc5bd1767967b125c58b1b2",
    albumCoverUrl: "https://i.scdn.co/image/ab67616d00001e02c6882ee558afd3c4b34c6097",
    albumName: "SCENES",
  },
  {
    name: "Brauxelion",
    pfpUrl: "https://i.scdn.co/image/ab6761610000e5eb016e30bb5088f89cb038d2dc",
    albumCoverUrl: "https://i.scdn.co/image/ab67616d00001e02729b19bb294efd31450039d0",
    albumName: "Xpeed Gear",
  },
  {
    name: "LATASHA",
    pfpUrl: "https://i.scdn.co/image/ab6761610000e5ebf93acfdbc34aeecb2f3bd0d1",
    albumCoverUrl: "https://i.scdn.co/image/ab67616d00001e02793523735641c057708528fe",
    albumName: "Tried + Tru",
  },
];
