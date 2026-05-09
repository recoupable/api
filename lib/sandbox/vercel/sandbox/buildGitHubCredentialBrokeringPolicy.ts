import { DEFAULT_NETWORK_POLICY } from "./constants";
import type { SandboxNetworkPolicy } from "./types";

export function buildGitHubCredentialBrokeringPolicy(token?: string): SandboxNetworkPolicy {
  if (!token) {
    return DEFAULT_NETWORK_POLICY;
  }

  const basicAuthToken = Buffer.from(`x-access-token:${token}`, "utf-8").toString("base64");

  return {
    allow: {
      "api.github.com": [
        {
          transform: [{ headers: { Authorization: `Bearer ${token}` } }],
        },
      ],
      "uploads.github.com": [
        {
          transform: [{ headers: { Authorization: `Bearer ${token}` } }],
        },
      ],
      "codeload.github.com": [
        {
          transform: [{ headers: { Authorization: `Bearer ${token}` } }],
        },
      ],
      "github.com": [
        {
          transform: [{ headers: { Authorization: `Basic ${basicAuthToken}` } }],
        },
      ],
      "*": [],
    },
  };
}
