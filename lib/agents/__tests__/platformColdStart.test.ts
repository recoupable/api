import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  redis: vi.fn(),
  connect: vi.fn(),
  state: vi.fn(),
  slack: vi.fn(),
  github: vi.fn(),
  whatsapp: vi.fn(),
  initialize: vi.fn(),
  webhook: vi.fn(),
  registerCoding: vi.fn(),
  registerContent: vi.fn(),
}));
vi.mock("next/server", async () => ({
  ...(await vi.importActual("next/server")),
  after: vi.fn(),
}));
vi.mock("ioredis", () => ({
  Redis: class {
    status = "wait";
    connect = calls.connect;
    on = vi.fn();
    constructor() {
      calls.redis();
    }
  },
}));
vi.mock("@chat-adapter/state-ioredis", () => ({
  createIoRedisState: calls.state,
}));
vi.mock("@chat-adapter/slack", () => ({
  SlackAdapter: class {
    name = "slack";
    initialize = calls.initialize;
    handleWebhook = calls.webhook;
    constructor() {
      calls.slack();
    }
  },
}));
vi.mock("@chat-adapter/github", () => ({ createGitHubAdapter: calls.github }));
vi.mock("@chat-adapter/whatsapp", () => ({ createWhatsAppAdapter: calls.whatsapp }));
// Registration modules import unrelated job/provider code. Their own suites
// exercise callbacks; here the real Chat singleton and adapter startup are used.
vi.mock("@/lib/coding-agent/handlers/registerHandlers", () => {
  calls.registerCoding();
  return {};
});
vi.mock("@/lib/agents/content/handlers/registerHandlers", () => {
  calls.registerContent();
  return {};
});

const env = {
  SLACK_BOT_TOKEN: "synthetic-token",
  SLACK_SIGNING_SECRET: "coding-secret",
  GITHUB_TOKEN: "synthetic-token",
  GITHUB_WEBHOOK_SECRET: "github-secret",
  REDIS_URL: "redis://synthetic.invalid:6379",
  CODING_AGENT_CALLBACK_SECRET: "synthetic-secret",
  SLACK_CONTENT_BOT_TOKEN: "synthetic-token",
  SLACK_CONTENT_SIGNING_SECRET: "content-secret",
  WHATSAPP_ACCESS_TOKEN: "synthetic-token",
  WHATSAPP_APP_SECRET: "whatsapp-secret",
  WHATSAPP_PHONE_NUMBER_ID: "synthetic-id",
  WHATSAPP_VERIFY_TOKEN: "verify-secret",
};
const params = (platform: string) => ({ params: Promise.resolve({ platform }) });
function request(platform: string, secret?: string, body = '{"type":"event_callback"}') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret && platform === "slack") {
    headers["x-slack-request-timestamp"] = timestamp;
    headers["x-slack-signature"] = `v0=${createHmac("sha256", secret)
      .update(`v0:${timestamp}:${body}`)
      .digest("hex")}`;
  } else if (secret) {
    headers["x-hub-signature-256"] =
      `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  }
  return new NextRequest(`https://synthetic.invalid/${platform}`, {
    method: "POST",
    body,
    headers,
  });
}
function expectCold() {
  for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  for (const key of Object.keys(env)) vi.stubEnv(key, "");
  calls.connect.mockResolvedValue(undefined);
  calls.state.mockReturnValue({ connect: vi.fn(), disconnect: vi.fn() });
  calls.github.mockReturnValue({
    name: "github",
    initialize: calls.initialize,
    handleWebhook: calls.webhook,
  });
  calls.whatsapp.mockReturnValue({
    name: "whatsapp",
    initialize: calls.initialize,
    handleWebhook: calls.webhook,
  });
  calls.webhook.mockImplementation(async (req: Request) => new Response(await req.text()));
});
afterEach(() => vi.unstubAllEnvs());

describe("cold agent platform routes", () => {
  it.each(["coding", "content"])(
    "imports %s route without bot configuration or state",
    async agent => {
      const route =
        agent === "coding"
          ? await import("@/app/api/coding-agent/[platform]/route")
          : await import("@/app/api/content-agent/[platform]/route");
      expectCold();
      for (const platform of ["unknown", "constructor", "toString", "__proto__"]) {
        expect((await route.POST(request(platform), params(platform))).status).toBe(404);
        expect(
          (await route.GET(new NextRequest("https://synthetic.invalid"), params(platform))).status,
        ).toBe(404);
      }
      expectCold();
    },
  );

  it.each(["coding", "content"])(
    "rejects unsigned ordinary %s Slack events before any construction",
    async agent => {
      const route =
        agent === "coding"
          ? await import("@/app/api/coding-agent/[platform]/route")
          : await import("@/app/api/content-agent/[platform]/route");
      expect((await route.POST(request("slack"), params("slack"))).status).toBe(401);
      expectCold();
    },
  );

  it("answers signed Slack setup without bot configuration or state", async () => {
    vi.stubEnv("SLACK_SIGNING_SECRET", env.SLACK_SIGNING_SECRET);
    const { POST } = await import("@/app/api/coding-agent/[platform]/route");
    const body = '{"type":"url_verification","challenge":"synthetic-challenge"}';
    const res = await POST(request("slack", env.SLACK_SIGNING_SECRET, body), params("slack"));
    expect(await res.json()).toEqual({ challenge: "synthetic-challenge" });
    expectCold();
  });

  it("rejects unsigned GitHub and configured WhatsApp events without state", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { POST } = await import("@/app/api/coding-agent/[platform]/route");
    for (const platform of ["github", "whatsapp"]) {
      expect((await POST(request(platform), params(platform))).status).toBe(401);
    }
    expectCold();
  });

  it("keeps WhatsApp optional and rejects unavailable platforms before state", async () => {
    const { GET, POST } = await import("@/app/api/coding-agent/[platform]/route");
    expect((await POST(request("whatsapp"), params("whatsapp"))).status).toBe(404);
    expect(
      (await GET(new NextRequest("https://synthetic.invalid"), params("whatsapp"))).status,
    ).toBe(404);
    expectCold();
  });

  it("preserves WhatsApp verification responses without state", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { GET } = await import("@/app/api/coding-agent/[platform]/route");
    for (const [token, status] of [
      ["wrong", 403],
      ["verify-secret", 200],
    ] as const) {
      const req = new NextRequest(
        `https://synthetic.invalid/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=challenge`,
      );
      const res = await GET(req, params("whatsapp"));
      expect(res.status).toBe(status);
      if (status === 200) expect(await res.text()).toBe("challenge");
    }
    expectCold();
  });

  it("loads a coding singleton once after verification and preserves raw event bytes", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { POST } = await import("@/app/api/coding-agent/[platform]/route");
    expectCold();
    for (const platform of ["slack", "github", "whatsapp", "slack"]) {
      const secret =
        platform === "slack"
          ? env.SLACK_SIGNING_SECRET
          : platform === "github"
            ? env.GITHUB_WEBHOOK_SECRET
            : env.WHATSAPP_APP_SECRET;
      const req = request(platform, secret, '{ "synthetic": true }');
      const res = await POST(req, params(platform));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('{ "synthetic": true }');
    }
    expect(calls.redis).toHaveBeenCalledOnce();
    expect(calls.state).toHaveBeenCalledOnce();
    expect(calls.state).toHaveBeenCalledWith(
      expect.objectContaining({ keyPrefix: "coding-agent" }),
    );
    expect(calls.slack).toHaveBeenCalledOnce();
    expect(calls.github).toHaveBeenCalledOnce();
    expect(calls.whatsapp).toHaveBeenCalledOnce();
    expect(calls.initialize).toHaveBeenCalledTimes(3);
    expect(calls.webhook).toHaveBeenCalledTimes(4);
    expect(calls.registerCoding).toHaveBeenCalledOnce();
    expect(calls.registerContent).not.toHaveBeenCalled();
    expect(calls.registerCoding.mock.invocationCallOrder[0]).toBeLessThan(
      calls.initialize.mock.invocationCallOrder[0],
    );
  });

  it("keeps authenticated content events unconfigured without constructing state", async () => {
    vi.stubEnv("SLACK_CONTENT_SIGNING_SECRET", env.SLACK_CONTENT_SIGNING_SECRET);
    const { POST } = await import("@/app/api/content-agent/[platform]/route");
    expect(
      (await POST(request("slack", env.SLACK_CONTENT_SIGNING_SECRET), params("slack"))).status,
    ).toBe(503);
    expectCold();
  });

  it("loads the content singleton only for signed events and keeps its state prefix", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { POST } = await import("@/app/api/content-agent/[platform]/route");
    expectCold();
    for (let count = 0; count < 2; count++) {
      expect(
        (await POST(request("slack", env.SLACK_CONTENT_SIGNING_SECRET), params("slack"))).status,
      ).toBe(200);
    }
    expect(calls.state).toHaveBeenCalledOnce();
    expect(calls.state).toHaveBeenCalledWith(
      expect.objectContaining({ keyPrefix: "content-agent" }),
    );
    expect(calls.slack).toHaveBeenCalledOnce();
    expect(calls.github).not.toHaveBeenCalled();
    expect(calls.whatsapp).not.toHaveBeenCalled();
    expect(calls.initialize).toHaveBeenCalledOnce();
    expect(calls.registerContent).toHaveBeenCalledOnce();
    expect(calls.registerCoding).not.toHaveBeenCalled();
  });

  it.each(["slack", "github", "whatsapp"])(
    "rejects tampered %s requests before bot loading",
    async platform => {
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      const { POST } = await import("@/app/api/coding-agent/[platform]/route");
      const req = request(platform, "wrong-secret");
      expect((await POST(req, params(platform))).status).toBe(401);
      expectCold();
    },
  );

  it("delegates a signed GET with the original waitUntil contract", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const { GET } = await import("@/app/api/coding-agent/[platform]/route");
    const signed = request("slack", env.SLACK_SIGNING_SECRET, "");
    const req = new NextRequest(signed.url, { headers: signed.headers });
    expect((await GET(req, params("slack"))).status).toBe(200);
    expect(calls.webhook).toHaveBeenCalledWith(req, { waitUntil: expect.any(Function) });
  });

  it("returns a bounded 500 if authenticated bot construction fails", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    calls.slack.mockImplementationOnce(() => {
      throw new Error("synthetic startup failure");
    });
    const { POST } = await import("@/app/api/coding-agent/[platform]/route");
    const response = await POST(request("slack", env.SLACK_SIGNING_SECRET), params("slack"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Agent webhook unavailable" });
    expect(calls.webhook).not.toHaveBeenCalled();
  });
});
