import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdapterFactory, Provider } from "oidc-provider";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { oauthScopes } from "../oauthScopes";
import { createOAuthConsentTickets } from "./createOAuthConsentTickets";
import { validateOAuthConsentBody } from "./validateOAuthConsentBody";

/** Handle browser-bound consent; call only behind the canonical issuer Node boundary. */
export function createOAuthConsentHandler(options: {
  config: OAuthRuntimeConfig;
  provider: Provider;
  adapter: AdapterFactory;
  resolveIdentity: (token: string) => Promise<{ accountId: string; subject: string }>;
}) {
  const { config, provider, adapter, resolveIdentity } = options;
  const tickets = createOAuthConsentTickets(adapter);
  return async (req: IncomingMessage, res: ServerResponse, uid: string) => {
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    };
    // Override broad API CORS headers: credentialed consent has exactly one trusted origin.
    res.removeHeader("Access-Control-Allow-Origin");
    res.setHeader("Vary", "Origin");
    if (req.headers.origin === config.consentOrigin) {
      res.setHeader("Access-Control-Allow-Origin", config.consentOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    } else if (req.headers.origin || req.method !== "GET" || req.headers.authorization) {
      reply(403, { error: "untrusted_origin" });
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "POST") {
      reply(405, { error: "method_not_allowed" });
      return;
    }
    try {
      const details = await provider.interactionDetails(req, res);
      if (details.uid !== uid || !["login", "consent"].includes(details.prompt.name))
        throw new Error();
      if (!req.headers.origin) {
        const destination = new URL(config.consentUrl);
        destination.searchParams.set("interaction", uid);
        res.writeHead(303, { Location: destination.href });
        res.end();
        return;
      }
      const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "");
      if (!bearer) {
        reply(401, { error: "login_required" });
        return;
      }
      const identity = await resolveIdentity(bearer[1]);
      const { params } = details;
      if (typeof params.client_id !== "string" || typeof params.scope !== "string")
        throw new Error();
      if (params.resource !== undefined && params.resource !== config.resource) throw new Error();
      const requested = [...new Set(params.scope.split(" ").filter(Boolean))];
      if (
        requested.some(
          scope =>
            !Object.hasOwn(oauthScopes, scope) && scope !== "openid" && scope !== "offline_access",
        )
      )
        throw new Error();
      const scopes = requested.filter(scope => Object.hasOwn(oauthScopes, scope));
      const binding = {
        ...identity,
        uid,
        clientId: params.client_id,
        resource: config.resource,
        scopes,
      };
      if (req.method === "GET") {
        const client = await provider.Client.find(params.client_id);
        if (!client) throw new Error();
        reply(200, {
          csrf: await tickets.issue(binding),
          clientId: binding.clientId,
          clientName: client.clientName ?? "Unnamed agent",
          clientVerified: false,
          accountId: identity.accountId,
          context: "personal",
          expiresIn: 300,
          accessDurationDays: 30,
          permissions: scopes.map(scope => ({
            scope,
            description: oauthScopes[scope as keyof typeof oauthScopes],
          })),
        });
        return;
      }
      if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
        reply(415, { error: "json_required" });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 16384) {
          reply(413, { error: "body_too_large" });
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      const body = validateOAuthConsentBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      await tickets.consume(body.csrf, binding);
      if (body.decision === "deny") {
        const redirectUrl = await provider.interactionResult(
          req,
          res,
          { error: "access_denied" },
          { mergeWithLastSubmission: false },
        );
        reply(200, { redirectUrl });
        return;
      }
      const grant = new provider.Grant({
        accountId: identity.accountId,
        clientId: binding.clientId,
      });
      grant.addResourceScope(config.resource, scopes);
      grant.addOIDCScope(requested);
      const grantId = await grant.save();
      try {
        await adapter("RecoupGrant").upsert(
          grantId,
          {
            accountId: identity.accountId,
            clientId: binding.clientId,
            grantId,
            extra: { subject: identity.subject, context: "personal", scopes, persistent: true },
          },
          30 * 86400,
        );
        const redirectUrl = await provider.interactionResult(
          req,
          res,
          {
            login: { accountId: identity.accountId, remember: false },
            consent: { grantId },
          },
          { mergeWithLastSubmission: false },
        );
        reply(200, { redirectUrl });
      } catch {
        await adapter("Grant").revokeByGrantId(grantId);
        throw new Error();
      }
    } catch {
      reply(400, { error: "invalid_or_expired_interaction" });
    }
  };
}
