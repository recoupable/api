import { createServer, request } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { apiResolver } from "next/dist/server/api-utils/node/api-resolver.js";
import { expect, it } from "vitest";
import { createPostgresTestAdapter } from "../fixtures/createPostgresTestAdapter";
import { createLabProvider } from "../createLabProvider";
import { createOAuthNodeHandler } from "../../../lib/oauth/createOAuthNodeHandler";

it("mounts the provider through Next Pages API with an intact request stream and issuer prefix", async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const issuer = `${origin}/api/oauth`;
  try {
    const provider = createLabProvider(
      issuer,
      new Map(),
      process.env.OAUTH_TEST_PG_SOCKET ? createPostgresTestAdapter(issuer) : undefined,
    );
    provider.proxy = true;
    const handler = createOAuthNodeHandler(issuer, provider.callback());
    server.on("request", (req, res) => {
      void apiResolver(
        req,
        res,
        {},
        { default: handler, config: { api: { bodyParser: false, externalResolver: true } } },
        {
          previewModeId: "fixture",
          previewModeEncryptionKey: "fixture",
          previewModeSigningKey: "fixture",
          dev: false,
        },
        false,
      );
    });
    const metadataResponse = await fetch(`${issuer}/.well-known/openid-configuration`, {
      headers: { "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https" },
    });
    expect(metadataResponse.status).toBe(200);
    const metadata = await metadataResponse.json();
    expect(metadata.issuer).toBe(issuer);
    expect(metadata.token_endpoint).toBe(`${issuer}/token`);
    const registered = await fetch(metadata.registration_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["https://agent.example/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      }),
    });
    expect(registered.status).toBe(201);
    const client = await registered.json();
    const invalidToken = await fetch(metadata.token_endpoint, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: client.client_id,
        code: "invalid",
        redirect_uri: "https://agent.example/callback",
        code_verifier: "x".repeat(43),
      }),
    });
    expect(invalidToken.status).toBe(400);
    expect((await invalidToken.json()).error).toBe("invalid_grant");
    expect((await fetch(`${origin}/wrong-path`)).status).toBe(404);
    const wrongHostStatus = await new Promise<number>((resolve, reject) => {
      request(
        `${issuer}/.well-known/openid-configuration`,
        { headers: { Host: "attacker.example" } },
        response => {
          response.resume();
          resolve(response.statusCode!);
        },
      )
        .on("error", reject)
        .end();
    });
    expect(wrongHostStatus).toBe(421);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
