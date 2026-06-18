import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildAuthConfigs } from "../buildAuthConfigs";

const AUTH_CONFIG_ENV_KEYS = [
  "COMPOSIO_TIKTOK_AUTH_CONFIG_ID",
  "COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID",
  "COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID",
  "COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID",
  "COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID",
  "COMPOSIO_YOUTUBE_AUTH_CONFIG_ID",
  "COMPOSIO_TWITTER_AUTH_CONFIG_ID",
  "COMPOSIO_LINKEDIN_AUTH_CONFIG_ID",
];

describe("buildAuthConfigs", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    // Snapshot then clear every auth-config env var so the test is isolated
    // from whatever .env.local provides.
    saved = {};
    for (const key of AUTH_CONFIG_ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of AUTH_CONFIG_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("returns undefined when no auth-config env vars are set", () => {
    expect(buildAuthConfigs()).toBeUndefined();
  });

  it("reads the Twitter and LinkedIn auth configs from env", () => {
    process.env.COMPOSIO_TWITTER_AUTH_CONFIG_ID = "ac_twitter_123";
    process.env.COMPOSIO_LINKEDIN_AUTH_CONFIG_ID = "ac_linkedin_456";

    expect(buildAuthConfigs()).toEqual({
      twitter: "ac_twitter_123",
      linkedin: "ac_linkedin_456",
    });
  });
});
