import { expect, it } from "vitest";
import { getAgentRegistrationProviderOptions } from "../getAgentRegistrationProviderOptions";
import { fixture } from "./fixture";

it.each([
  ["https://api.recoupable.dev/api/oauth", "https://recoupable.dev/auth.md"],
  ["http://127.0.0.1:43333/api/oauth", "http://127.0.0.1:43333/api/oauth/auth.md"],
  [
    "https://recoup-api-preview.vercel.app/api/oauth",
    "https://recoup-api-preview.vercel.app/api/oauth/auth.md",
  ],
  [
    "https://api.recoupable.dev.example/api/oauth",
    "https://api.recoupable.dev.example/api/oauth/auth.md",
  ],
])("advertises the canonical guide without changing the issuer %s", (issuer, skill) => {
  const config = { ...fixture().config, issuer };
  const options = getAgentRegistrationProviderOptions(config);
  expect(options.discovery).toMatchObject({
    agent_auth: {
      skill,
      identity_endpoint: `${issuer}/agent/identity`,
      claim_endpoint: `${issuer}/agent/identity/claim`,
      identity_types_supported: ["service_auth"],
    },
  });
  expect(options.clients?.[0]).toMatchObject({ scope: "mcp:read", grant_types: [] });
});

it("keeps registration metadata absent when the feature is disabled", () => {
  const config = {
    ...fixture().config,
    issuer: "https://api.recoupable.dev/api/oauth",
    agentAuthEnabled: false,
  };
  expect(getAgentRegistrationProviderOptions(config)).toEqual({
    clients: [],
    discovery: {},
  });
});
