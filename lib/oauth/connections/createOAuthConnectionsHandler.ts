import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { createOAuthConnections } from "../createOAuthConnections";

/** Manage grants with first-party login only: a delegated token cannot manage connections. */
export function createOAuthConnectionsHandler(options: {
  origin: string;
  resolveIdentity: (token: string) => Promise<{ accountId: string; subject: string }>;
  connections: ReturnType<typeof createOAuthConnections>;
}) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, data?: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(data === undefined ? undefined : JSON.stringify(data));
    };
    res.removeHeader("Access-Control-Allow-Origin");
    res.setHeader("Vary", "Origin");
    if (req.headers.origin !== options.origin) return reply(403, { error: "untrusted_origin" });
    res.setHeader("Access-Control-Allow-Origin", options.origin);
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return reply(204);
    const path = req.url?.split("?")[0];
    const match = /^\/connections\/([^/]+)$/.exec(path ?? "");
    const id = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .safeParse(match?.[1]);
    if (
      !(req.method === "GET" && path === "/connections") &&
      !(req.method === "DELETE" && id.success)
    )
      return reply(405, { error: "unsupported_request" });
    const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "");
    if (!bearer) return reply(401, { error: "login_required" });
    let accountId: string;
    try {
      ({ accountId } = await options.resolveIdentity(bearer[1]));
    } catch {
      return reply(401, { error: "login_required" });
    }
    try {
      if (req.method === "GET") return reply(200, await options.connections.list(accountId));
      await options.connections.revoke(accountId, id.data!);
      return reply(204);
    } catch (error) {
      if (error instanceof Error && error.message === "Connection access denied")
        return reply(404, { error: "connection_unavailable" });
      console.error("OAuth connections unavailable", { event: "oauth_connections_unavailable" });
      return reply(503, { error: "connection_request_failed" });
    }
  };
}
