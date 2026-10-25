import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { ConsoleLogger } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { createGitHubAdapter } from "@chat-adapter/github";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";
import { describe, expect, it } from "vitest";
import { validatePlatformWebhookRequest } from "@/lib/agents/validatePlatformWebhookRequest";

// Real installed adapters, used only for inert/no-event payloads. They are never
// initialized, and these calls run under the audit's process-wide network guard.
const secret = "synthetic-signing-secret";
const adapters = {
  slack: new SlackAdapter({
    botToken: "synthetic-token",
    signingSecret: secret,
    logger: new ConsoleLogger("silent"),
  }),
  github: createGitHubAdapter({ token: "synthetic-token", webhookSecret: secret }),
  whatsapp: createWhatsAppAdapter({
    accessToken: "synthetic-token",
    appSecret: secret,
    phoneNumberId: "synthetic-id",
    verifyToken: "synthetic-verify-token",
  }),
};

describe("preflight matches installed adapter signatures", () => {
  for (const platform of ["slack", "github", "whatsapp"] as const) {
    it.each(["valid", "missing", "wrong", "short", "tampered"])(
      `${platform}: %s signature`,
      async variant => {
        const body = platform === "whatsapp" ? '{ "entry": [] }' : '{ "type": "synthetic" }';
        const timestamp = String(Math.floor(Date.now() / 1000));
        const key = variant === "wrong" ? "wrong-secret" : secret;
        const signature =
          platform === "slack"
            ? `v0=${createHmac("sha256", key).update(`v0:${timestamp}:${body}`).digest("hex")}`
            : `sha256=${createHmac("sha256", key).update(body).digest("hex")}`;
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (platform === "slack") headers["x-slack-request-timestamp"] = timestamp;
        if (variant !== "missing")
          headers[platform === "slack" ? "x-slack-signature" : "x-hub-signature-256"] =
            variant === "short" ? "bad" : signature;
        const req = new NextRequest(`https://synthetic.invalid/${platform}`, {
          method: "POST",
          headers,
          body: variant === "tampered" ? body + " " : body,
        });
        const sdkResponse = await adapters[platform].handleWebhook(req.clone());
        const earlyResponse = await validatePlatformWebhookRequest(req, platform, secret);
        if (variant === "valid") {
          expect(earlyResponse).toBeNull();
          expect(sdkResponse.status).toBe(200);
        } else {
          expect(earlyResponse?.status).toBe(sdkResponse.status);
          expect(earlyResponse?.status).toBe(401);
        }
        expect(await req.text()).toBe(variant === "tampered" ? body + " " : body);
      },
    );
  }

  it.each([
    "hub.mode=subscribe&hub.verify_token=synthetic-verify-token&hub.challenge=value",
    "hub.mode=subscribe&hub.verify_token=synthetic-verify-token",
    "hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=value",
    "hub.mode=wrong&hub.verify_token=synthetic-verify-token",
    "",
  ])("matches WhatsApp GET verification for %s", async query => {
    const req = new NextRequest(`https://synthetic.invalid/whatsapp?${query}`);
    const sdkResponse = await adapters.whatsapp.handleWebhook(req.clone());
    const response = await validatePlatformWebhookRequest(
      req,
      "whatsapp",
      secret,
      "synthetic-verify-token",
    );
    expect(response?.status).toBe(sdkResponse.status);
    expect(await response?.text()).toBe(await sdkResponse.text());
  });
});
