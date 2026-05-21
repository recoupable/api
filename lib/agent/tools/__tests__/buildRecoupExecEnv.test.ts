import { describe, it, expect } from "vitest";
import { buildRecoupExecEnv } from "@/lib/agent/tools/buildRecoupExecEnv";

const baseSandbox = { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" };

describe("buildRecoupExecEnv", () => {
  it("returns undefined when no context", () => {
    expect(buildRecoupExecEnv(undefined)).toBeUndefined();
    expect(buildRecoupExecEnv(null)).toBeUndefined();
    expect(buildRecoupExecEnv("not-a-context")).toBeUndefined();
  });

  it("returns undefined when context has no recoupOrgId", () => {
    expect(buildRecoupExecEnv({ sandbox: baseSandbox })).toBeUndefined();
  });

  it("injects RECOUP_ORG_ID when present in context", () => {
    const env = buildRecoupExecEnv({ sandbox: baseSandbox, recoupOrgId: "org-uuid" });
    expect(env).toEqual({ RECOUP_ORG_ID: "org-uuid" });
  });

  it("ignores empty-string recoupOrgId", () => {
    const env = buildRecoupExecEnv({ sandbox: baseSandbox, recoupOrgId: "" });
    expect(env).toBeUndefined();
  });

  it("returns undefined when the input is not a valid AgentContext shape", () => {
    expect(buildRecoupExecEnv({ recoupOrgId: "org-uuid" })).toBeUndefined();
    expect(buildRecoupExecEnv({ sandbox: null, recoupOrgId: "org-uuid" })).toBeUndefined();
  });
});
