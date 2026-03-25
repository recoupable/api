import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isContentAgentConfigured } from "../isContentAgentConfigured";
import { CONTENT_AGENT_REQUIRED_ENV_VARS } from "../validateContentAgentEnv";

describe("isContentAgentConfigured", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of CONTENT_AGENT_REQUIRED_ENV_VARS) {
      process.env[key] = "test-value";
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns true when all required env vars are set", () => {
    expect(isContentAgentConfigured()).toBe(true);
  });

  it("returns false when any required env var is missing", () => {
    delete process.env.CODING_AGENT_CALLBACK_SECRET;
    expect(isContentAgentConfigured()).toBe(false);
  });
});
