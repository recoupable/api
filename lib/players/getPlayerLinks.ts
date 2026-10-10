export function getPlayerLinks(id: string) {
  const origin = process.env.PLAYER_APP_ORIGIN || "https://app.recoupable.dev";
  return {
    listenUrl: `${origin}/listen/${id}`,
    spotifyEmbedUrl: `${origin}/listen/${id}/spotify`,
    appleEmbedUrl: `${origin}/listen/${id}/apple_music`,
  };
}
