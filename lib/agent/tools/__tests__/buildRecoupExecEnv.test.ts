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

  // recoupable/chat#1815: the headless /api/chat/runs path plumbs an ephemeral
  // `recoup_sk_` API KEY (not a Privy JWT) through recoupAccessToken. REST
  // endpoints reject an API key over `Authorization: Bearer` (the JWT path,
  // 401) but accept it via `x-api-key`. So a `recoup_sk_` token must surface as
  // RECOUP_API_KEY — which the recoup-api skill sends as `x-api-key` — NOT as
  // RECOUP_ACCESS_TOKEN (which it sends as Bearer).
  it("surfaces a recoup_sk_ API key as RECOUP_API_KEY (x-api-key), not RECOUP_ACCESS_TOKEN", () => {
    const env = buildRecoupExecEnv({
      sandbox: baseSandbox,
      recoupAccessToken: "recoup_sk_abc123",
    });
    expect(env).toEqual({ RECOUP_API_KEY: "recoup_sk_abc123" });
  });

  it("still surfaces a non-recoup_sk_ token (Privy JWT) as RECOUP_ACCESS_TOKEN (Bearer)", () => {
    const env = buildRecoupExecEnv({
      sandbox: baseSandbox,
      recoupAccessToken: "eyJhbGciOiJFUzI1NiI.test.jwt",
    });
    expect(env).toEqual({ RECOUP_ACCESS_TOKEN: "eyJhbGciOiJFUzI1NiI.test.jwt" });
  });

  it("injects RECOUP_ORG_ID alongside a recoup_sk_ key", () => {
    const env = buildRecoupExecEnv({
      sandbox: baseSandbox,
      recoupOrgId: "org-uuid",
      recoupAccessToken: "recoup_sk_xyz",
    });
    expect(env).toEqual({ RECOUP_ORG_ID: "org-uuid", RECOUP_API_KEY: "recoup_sk_xyz" });
  });
});
