import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("SUBMODULE_CONFIG", () => {
    it("maps api to test base branch", async () => {
      const { SUBMODULE_CONFIG } = await import("../config");
      expect(SUBMODULE_CONFIG.api.baseBranch).toBe("test");
    });

    it("maps chat to test base branch", async () => {
      const { SUBMODULE_CONFIG } = await import("../config");
      expect(SUBMODULE_CONFIG.chat.baseBranch).toBe("test");
    });

    it("maps tasks to main base branch", async () => {
      const { SUBMODULE_CONFIG } = await import("../config");
      expect(SUBMODULE_CONFIG.tasks.baseBranch).toBe("main");
    });

    it("maps docs to main base branch", async () => {
      const { SUBMODULE_CONFIG } = await import("../config");
      expect(SUBMODULE_CONFIG.docs.baseBranch).toBe("main");
    });

    it("includes repo URL for each submodule", async () => {
      const { SUBMODULE_CONFIG } = await import("../config");
      expect(SUBMODULE_CONFIG.api.repo).toBe("recoupable/recoup-api");
      expect(SUBMODULE_CONFIG.chat.repo).toBe("recoupable/chat");
      expect(SUBMODULE_CONFIG.tasks.repo).toBe("recoupable/tasks");
    });
  });

  describe("getAllowedChannelIds", () => {
    it("parses comma-separated channel IDs from env", async () => {
      process.env.CODING_AGENT_CHANNELS = "C123,C456,C789";
      const { getAllowedChannelIds } = await import("../config");
      expect(getAllowedChannelIds()).toEqual(["C123", "C456", "C789"]);
    });

    it("returns empty array when env is not set", async () => {
      delete process.env.CODING_AGENT_CHANNELS;
      const { getAllowedChannelIds } = await import("../config");
      expect(getAllowedChannelIds()).toEqual([]);
    });

    it("trims whitespace from channel IDs", async () => {
      process.env.CODING_AGENT_CHANNELS = " C123 , C456 ";
      const { getAllowedChannelIds } = await import("../config");
      expect(getAllowedChannelIds()).toEqual(["C123", "C456"]);
    });
  });

  describe("getAllowedUserIds", () => {
    it("parses comma-separated user IDs from env", async () => {
      process.env.CODING_AGENT_USERS = "U111,U222";
      const { getAllowedUserIds } = await import("../config");
      expect(getAllowedUserIds()).toEqual(["U111", "U222"]);
    });

    it("returns empty array when env is not set", async () => {
      delete process.env.CODING_AGENT_USERS;
      const { getAllowedUserIds } = await import("../config");
      expect(getAllowedUserIds()).toEqual([]);
    });
  });
});
