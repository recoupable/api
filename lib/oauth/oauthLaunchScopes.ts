import { oauthScopes } from "./oauthScopes";
/** Preserve limited grants; broader capabilities require explicit full-tool consent. */
export const oauthLaunchScopes = {
  "mcp:read": "Read your personal artist profiles, social profiles, and chat list",
  "mcp:write": "Create personal artists and update their profiles",
  "mcp:tools": oauthScopes["mcp:tools"],
} as const;
