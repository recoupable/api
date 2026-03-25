import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateContentAgentEnv,
  CONTENT_AGENT_REQUIRED_ENV_VARS,
} from "../validateContentAgentEnv";

describe("validateContentAgentEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of CONTENT_AGENT_REQUIRED_ENV_VARS) {
      process.env[key] = "test-value";
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not throw when all required env vars are set", () => {
    expect(() => validateContentAgentEnv()).not.toThrow();
  });

  it("throws when a required env var is missing", () => {
    delete process.env.SLACK_CONTENT_BOT_TOKEN;
    expect(() => validateContentAgentEnv()).toThrow(/Missing required environment variables/);
  });

  it("lists all missing vars in the error message", () => {
    delete process.env.SLACK_CONTENT_BOT_TOKEN;
    delete process.env.REDIS_URL;
    expect(() => validateContentAgentEnv()).toThrow("SLACK_CONTENT_BOT_TOKEN");
    expect(() => validateContentAgentEnv()).toThrow("REDIS_URL");
  });

  it("requires CODING_AGENT_CALLBACK_SECRET, not CONTENT_AGENT_CALLBACK_SECRET", () => {
    expect(CONTENT_AGENT_REQUIRED_ENV_VARS).toContain("CODING_AGENT_CALLBACK_SECRET");
    expect(CONTENT_AGENT_REQUIRED_ENV_VARS).not.toContain("CONTENT_AGENT_CALLBACK_SECRET");
  });
});
