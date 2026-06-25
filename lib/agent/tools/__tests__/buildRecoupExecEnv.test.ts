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

  // Bundle A.4 contract: when the handler has plumbed a Privy JWT into
  // AgentContext.recoupAccessToken, it MUST be surfaced as the
  // `RECOUP_ACCESS_TOKEN` env var so the recoup-api skill's curl
  // examples can authenticate. Currently failing on production —
  // verified end-to-end against api prod: agent reports
  // "RECOUP_ACCESS_TOKEN is not set" even when client sent it.
  // Open-agents prod passes the equivalent test
  // (TOKEN_SET length=413). This test will flip from red → green
  // when A.4 lands.
  it("injects RECOUP_ACCESS_TOKEN when present in context", () => {
    const env = buildRecoupExecEnv({
      sandbox: baseSandbox,
      recoupAccessToken: "eyJhbGciOiJFUzI1NiI.test.jwt",
    });
    expect(env).toEqual({ RECOUP_ACCESS_TOKEN: "eyJhbGciOiJFUzI1NiI.test.jwt" });
  });

  it("ignores empty-string recoupAccessToken", () => {
    const env = buildRecoupExecEnv({ sandbox: baseSandbox, recoupAccessToken: "" });
    expect(env).toBeUndefined();
  });

  it("injects BOTH RECOUP_ORG_ID and RECOUP_ACCESS_TOKEN when both are set", () => {
    const env = buildRecoupExecEnv({
      sandbox: baseSandbox,
      recoupOrgId: "org-uuid",
      recoupAccessToken: "jwt.value",
    });
    expect(env).toEqual({
      RECOUP_ORG_ID: "org-uuid",
      RECOUP_ACCESS_TOKEN: "jwt.value",
    });
  });

  // recoupable/chat#1815: both a Privy JWT and an ephemeral `recoup_sk_` API
  // key surface as RECOUP_ACCESS_TOKEN (Bearer). The server parses the token
  // format and authenticates a `recoup_sk_` key over Bearer too, so there is no
  // client-side x-api-key routing here.
  it("surfaces a recoup_sk_ API key as RECOUP_ACCESS_TOKEN (Bearer)", () => {
    const env = buildRecoupExecEnv({
      sandbox: baseSandbox,
      recoupAccessToken: "recoup_sk_abc123",
    });
    expect(env).toEqual({ RECOUP_ACCESS_TOKEN: "recoup_sk_abc123" });
  });

  it("injects RECOUP_ORG_ID alongside a recoup_sk_ key", () => {
    const env = buildRecoupExecEnv({
      sandbox: baseSandbox,
      recoupOrgId: "org-uuid",
      recoupAccessToken: "recoup_sk_xyz",
    });
    expect(env).toEqual({ RECOUP_ORG_ID: "org-uuid", RECOUP_ACCESS_TOKEN: "recoup_sk_xyz" });
  });
});
