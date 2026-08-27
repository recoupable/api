import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getApifyWebhooks } from "../getApifyWebhooks";

describe("getApifyWebhooks", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns the prod-aliased webhook URL when VERCEL_ENV is production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "recoup-api-abc.vercel.app";

    expect(getApifyWebhooks({ origin: "artist" })).toEqual([
      {
        eventTypes: ["ACTOR.RUN.SUCCEEDED"],
        requestUrl: "https://recoup-api.vercel.app/api/apify",
        payloadTemplate:
          '{"userId":{{userId}},"createdAt":{{createdAt}},"eventType":{{eventType}},"eventData":{{eventData}},"resource":{{resource}},"origin":"artist"}',
      },
    ]);
  });

  it("returns the deployment-specific URL on preview deploys", () => {
    delete process.env.VERCEL_ENV;
    process.env.VERCEL_URL = "preview-xyz.vercel.app";

    expect(getApifyWebhooks({ origin: "artist" })[0]).toMatchObject({
      eventTypes: ["ACTOR.RUN.SUCCEEDED"],
      requestUrl: "https://preview-xyz.vercel.app/api/apify",
    });
  });

  it("stamps origin + parentRunId into the payload so the webhook knows the run's lineage without another Apify call", () => {
    process.env.VERCEL_ENV = "production";

    const [hook] = getApifyWebhooks({ origin: "fan", parentRunId: "run_parent" });
    expect(hook.payloadTemplate).toBe(
      '{"userId":{{userId}},"createdAt":{{createdAt}},"eventType":{{eventType}},"eventData":{{eventData}},"resource":{{resource}},"origin":"fan","parentRunId":"run_parent"}',
    );
  });

  it("returns no webhooks locally so we don't hand Apify an unreachable URL", () => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;

    expect(getApifyWebhooks({ origin: "artist" })).toEqual([]);
  });
});
