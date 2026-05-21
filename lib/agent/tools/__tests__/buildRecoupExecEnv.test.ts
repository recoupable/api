import { describe, it, expect } from "vitest";
import { buildRecoupExecEnv } from "@/lib/agent/tools/buildRecoupExecEnv";

describe("buildRecoupExecEnv", () => {
  it("returns undefined when neither token nor orgId is in context", () => {
    expect(buildRecoupExecEnv(undefined)).toBeUndefined();
    expect(buildRecoupExecEnv({ sandbox: { state: {}, workingDirectory: "/x" } })).toBeUndefined();
  });

  it("injects RECOUP_ACCESS_TOKEN when present", () => {
    const env = buildRecoupExecEnv({
      sandbox: { state: {}, workingDirectory: "/x" },
      recoupAccessToken: "rk_abc",
    });
    expect(env).toEqual({ RECOUP_ACCESS_TOKEN: "rk_abc" });
  });

  it("injects RECOUP_ORG_ID when present", () => {
    const env = buildRecoupExecEnv({
      sandbox: { state: {}, workingDirectory: "/x" },
      recoupOrgId: "org-uuid",
    });
    expect(env).toEqual({ RECOUP_ORG_ID: "org-uuid" });
  });

  it("injects both when both present", () => {
    const env = buildRecoupExecEnv({
      sandbox: { state: {}, workingDirectory: "/x" },
      recoupAccessToken: "rk_abc",
      recoupOrgId: "org-uuid",
    });
    expect(env).toEqual({
      RECOUP_ACCESS_TOKEN: "rk_abc",
      RECOUP_ORG_ID: "org-uuid",
    });
  });

  it("ignores empty-string token (avoids injecting `RECOUP_ACCESS_TOKEN=`)", () => {
    const env = buildRecoupExecEnv({
      sandbox: { state: {}, workingDirectory: "/x" },
      recoupAccessToken: "",
    });
    expect(env).toBeUndefined();
  });
});
