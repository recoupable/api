import { SiteError } from "@/lib/sites/SiteError";
import { ZodError } from "zod";
/** Browser clients only communicate from Recoup's trusted player origin. */
export async function publicPlayerResponse(
  request: Request,
  operation: () => Promise<unknown>,
  write = false,
) {
  const origin = process.env.PLAYER_APP_ORIGIN || "https://app.recoupable.dev";
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
  if (write && request.headers.get("origin") !== origin)
    return Response.json({ error: "Invalid player origin" }, { status: 403, headers });
  try {
    return Response.json(await operation(), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof SiteError
            ? error.message
            : error instanceof ZodError
              ? "Invalid player request"
              : "Player unavailable",
      },
      {
        status: error instanceof SiteError ? error.status : error instanceof ZodError ? 400 : 503,
        headers,
      },
    );
  }
}
