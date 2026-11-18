import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { oauthGrantContextSchema } from "../oauthGrantContextSchema";

it("pins the old verifier to its exact pre-selected source bytes", () => {
  const source = readFileSync(
    new URL(
      "../../../scripts/mcp-oauth/fixtures/preSelectedResolveOAuthAccess.ts",
      import.meta.url,
    ),
  );
  expect(createHash("sha256").update(source).digest("hex")).toBe(
    "6af7c2bbc273f7fb662b56e54eddab8a359e66f665c573e2f361496f3dd90450",
  );
});

it("requires a matched versioned discriminator and selection without widening legacy attribution", () => {
  const selectedContext = {
    version: 1,
    capabilityVersion: "context-workspace-v1",
    mode: "selected_context",
    kind: "personal",
    ownerId: "00000000-0000-4000-8000-000000000001",
    organizationId: null,
  };
  expect(oauthGrantContextSchema.safeParse({ context: "personal" }).success).toBe(true);
  expect(
    oauthGrantContextSchema.safeParse({ context: "selected_context_v1", selectedContext }).success,
  ).toBe(true);
  for (const value of [
    { context: "personal", selectedContext },
    { context: "personal", selectedContext: undefined },
    { context: "selected_context_v1" },
    { context: "selected_context_v1", selectedContext: null },
    { context: "selected_context_v2", selectedContext },
    {
      context: "selected_context_v1",
      selectedContext: { ...selectedContext, capabilityVersion: "context-workspace-v2" },
    },
  ])
    expect(oauthGrantContextSchema.safeParse(value).success).toBe(false);
});
