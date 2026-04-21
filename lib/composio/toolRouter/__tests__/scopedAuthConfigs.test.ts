import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scopedAuthConfigs } from "../scopedAuthConfigs";

const ENV_KEYS = [
  "COMPOSIO_TIKTOK_AUTH_CONFIG_ID",
  "COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID",
  "COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID",
  "COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID",
  "COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID",
] as const;

describe("scopedAuthConfigs", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("returns undefined when no auth configs are configured", () => {
    expect(scopedAuthConfigs(["googlesheets", "tiktok"])).toBeUndefined();
  });

  it("returns undefined when no configured slugs are in the enabled list", () => {
    process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID = "ac_tiktok";

    expect(scopedAuthConfigs(["googlesheets"])).toBeUndefined();
  });

  it("returns only auth configs whose slug is in the enabled list", () => {
    process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID = "ac_tiktok";
    process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID = "ac_instagram";
    process.env.COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID = "ac_docs";

    const result = scopedAuthConfigs(["tiktok", "googledocs"]);

    expect(result).toEqual({
      tiktok: "ac_tiktok",
      googledocs: "ac_docs",
    });
  });
});
