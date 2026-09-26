/** Parse a submitted Spotify album locator without routing it through track ingestion. */
export function parseContextReleaseUrl(input: string) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "open.spotify.com" ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Use a public HTTPS Spotify album URL");
  const id = url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?album\/([A-Za-z0-9]{22})\/?$/)?.[1];
  if (!id) throw new Error("Use a Spotify album URL, including a single's album page");
  return { id, url: `https://open.spotify.com/album/${id}` };
}
