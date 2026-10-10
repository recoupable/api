/** Explicit public browser transport policy; artist websites never receive provider tokens. */
export function playerPreflight(request: Request) {
  const origin = process.env.PLAYER_APP_ORIGIN || "https://app.recoupable.dev";
  const allowed = request.headers.get("origin") === origin;
  return new Response(null, {
    status: allowed ? 204 : 403,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      Vary: "Origin",
    },
  });
}
