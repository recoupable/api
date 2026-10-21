import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as codingGet, POST as codingPost } from "@/app/api/coding-agent/[platform]/route";
import { POST as contentPost } from "@/app/api/content-agent/[platform]/route";
import { POST as chatPost } from "@/app/api/chat/slack/route";
import { createPlatformRoutes } from "@/lib/agents/createPlatformRoutes";

const bots = vi.hoisted(() => ({
  coding: { initialize: vi.fn(), webhooks: { slack: vi.fn() } },
  content: { initialize: vi.fn(), webhooks: { slack: vi.fn() } },
  chat: { initialize: vi.fn(), webhooks: { slack: vi.fn() } },
}));
vi.mock("@/lib/coding-agent/bot", () => ({ codingAgentBot: bots.coding }));
vi.mock("@/lib/agents/content/bot", () => ({ contentAgentBot: bots.content }));
vi.mock("@/lib/slack/chat/bot", () => ({ slackChatBot: bots.chat }));
vi.mock("@/lib/coding-agent/handlers/registerHandlers", () => ({}));
vi.mock("@/lib/agents/content/handlers/registerHandlers", () => ({}));
vi.mock("@/lib/slack/chat/handlers/registerHandlers", () => ({}));
vi.mock("next/server", async () => ({
  ...(await vi.importActual("next/server")),
  after: vi.fn(),
}));

const now = 1_800_000_000;
const rawBody = '{ "type": "url_verification", "challenge": "test-challenge" }';
function request(secret?: string, timestamp = String(now), body = rawBody) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== undefined) {
    headers["x-slack-request-timestamp"] = timestamp;
    headers["x-slack-signature"] = `v0=${createHmac("sha256", secret)
      .update(`v0:${timestamp}:${body}`)
      .digest("hex")}`;
  }
  return new NextRequest("https://example.com/slack", { method: "POST", body, headers });
}
const params = { params: Promise.resolve({ platform: "slack" }) };
const routes = [
  {
    name: "coding",
    post: (req: NextRequest) => codingPost(req, params),
    bot: bots.coding,
    secret: "coding-secret",
    env: "SLACK_SIGNING_SECRET",
  },
  {
    name: "content",
    post: (req: NextRequest) => contentPost(req, params),
    bot: bots.content,
    secret: "content-secret",
    env: "SLACK_CONTENT_SIGNING_SECRET",
  },
  {
    name: "chat",
    post: chatPost,
    bot: bots.chat,
    secret: "chat-secret",
    env: "SLACK_CHAT_SIGNING_SECRET",
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now * 1000);
  for (const route of routes) {
    vi.stubEnv(route.env, route.secret);
    route.bot.webhooks.slack.mockResolvedValue(new Response("adapter result"));
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

for (const route of routes) {
  describe(`${route.name} Slack challenge`, () => {
    it("accepts its own signature over the exact raw bytes without initialization", async () => {
      const req = request(route.secret);
      const response = await route.post(req);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ challenge: "test-challenge" });
      expect(await req.text()).toBe(rawBody);
      expect(route.bot.initialize).not.toHaveBeenCalled();
      expect(route.bot.webhooks.slack).not.toHaveBeenCalled();
    });
    it.each([undefined, "different-app-secret"])(
      "rejects missing or other-app signature %s",
      async secret => {
        const response = await route.post(request(secret));
        expect(response.status).toBe(401);
        expect(route.bot.initialize).not.toHaveBeenCalled();
        expect(route.bot.webhooks.slack).not.toHaveBeenCalled();
      },
    );
    it.each([String(now - 301), String(now + 301), `${now}garbage`, "NaN", ""])(
      "rejects stale, future or malformed timestamp %s",
      async timestamp => {
        expect((await route.post(request(route.secret, timestamp))).status).toBe(401);
        expect(route.bot.initialize).not.toHaveBeenCalled();
      },
    );
    it.each([-300, 300])("accepts the inclusive replay-window boundary %s", async delta => {
      expect((await route.post(request(route.secret, String(now + delta)))).status).toBe(200);
    });
    it.each(["v0=short", `v0=${"z".repeat(64)}`, `v1=${"a".repeat(64)}`])(
      "rejects malformed signature %s",
      async signature => {
        const req = request(route.secret);
        req.headers.set("x-slack-signature", signature);
        expect((await route.post(req)).status).toBe(401);
      },
    );
    it("rejects a tampered body", async () => {
      const req = request(route.secret);
      const tampered = new NextRequest(req.url, {
        method: "POST",
        headers: req.headers,
        body: rawBody.replace("test-challenge", "tampered"),
      });
      expect((await route.post(tampered)).status).toBe(401);
    });
    it("fails closed when the matching app secret is absent", async () => {
      vi.stubEnv(route.env, "");
      expect((await route.post(request(route.secret))).status).toBe(401);
    });
    it("leaves ordinary event verification and body consumption to the adapter", async () => {
      const body = '{"type":"event_callback"}';
      const req = request(undefined, String(now), body);
      expect((await route.post(req)).status).toBe(200);
      expect(route.bot.initialize).toHaveBeenCalledOnce();
      expect(route.bot.webhooks.slack).toHaveBeenCalledWith(req, expect.any(Object));
      expect(await req.text()).toBe(body);
    });
  });
}

describe("unknown platform", () => {
  it.each(["unknown", "toString", "constructor"])(
    "rejects %s before initialize",
    async platform => {
      const { POST } = createPlatformRoutes({ getBot: () => bots.coding });
      expect((await POST(request(), { params: Promise.resolve({ platform }) })).status).toBe(404);
      expect(bots.coding.initialize).not.toHaveBeenCalled();
    },
  );
  it("does not initialize when the handler is absent even if initialize would throw", async () => {
    bots.coding.initialize.mockRejectedValueOnce(new Error("Redis unavailable"));
    const { POST } = createPlatformRoutes({ getBot: () => bots.coding });
    expect(
      (await POST(request(), { params: Promise.resolve({ platform: "unknown" }) })).status,
    ).toBe(404);
    expect(bots.coding.initialize).not.toHaveBeenCalled();
    bots.coding.initialize.mockReset();
  });
});

describe("coding-agent GET platform probes", () => {
  it("delegates a supported platform without initialization", async () => {
    const req = new NextRequest("https://example.com/api/coding-agent/slack");
    expect((await codingGet(req, params)).status).toBe(200);
    expect(bots.coding.webhooks.slack).toHaveBeenCalledWith(req, expect.any(Object));
    expect(bots.coding.initialize).not.toHaveBeenCalled();
  });
  it.each(["unknown", "toString", "constructor"])(
    "returns 404 for %s without initialization",
    async platform => {
      const req = new NextRequest("https://example.com/api/coding-agent/unknown");
      expect((await codingGet(req, { params: Promise.resolve({ platform }) })).status).toBe(404);
      expect(bots.coding.webhooks.slack).not.toHaveBeenCalled();
      expect(bots.coding.initialize).not.toHaveBeenCalled();
    },
  );
});
