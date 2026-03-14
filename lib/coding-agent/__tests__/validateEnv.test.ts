import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const REQUIRED_VARS = [
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "GITHUB_TOKEN",
  "GITHUB_WEBHOOK_SECRET",
  "REDIS_URL",
  "CODING_AGENT_CALLBACK_SECRET",
];

describe("validateCodingAgentEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    for (const key of REQUIRED_VARS) {
      process.env[key] = "test-value";
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not throw when all required vars are set", async () => {
    const { validateCodingAgentEnv } = await import("../validateEnv");
    expect(() => validateCodingAgentEnv()).not.toThrow();
  });

  it("throws listing all missing vars when none are set", async () => {
    for (const key of REQUIRED_VARS) {
      delete process.env[key];
    }

    const { validateCodingAgentEnv } = await import("../validateEnv");
    expect(() => validateCodingAgentEnv()).toThrow("SLACK_BOT_TOKEN");
    expect(() => validateCodingAgentEnv()).toThrow("REDIS_URL");
  });

  it("throws listing only the missing var", async () => {
    delete process.env.SLACK_BOT_TOKEN;

    const { validateCodingAgentEnv } = await import("../validateEnv");
    expect(() => validateCodingAgentEnv()).toThrow("SLACK_BOT_TOKEN");
  });
});
