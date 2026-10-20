/** The first registration release grants a bounded personal read session only. */
export const agentRegistrationPolicy = {
  clientId: "recoup-service-auth",
  clientName: "Agent registration (read only)",
  scope: "mcp:read",
  claimSeconds: 600,
  accessSeconds: 300,
  connectionSeconds: 3600,
  intervalSeconds: 5,
  maxCodeAttempts: 5,
  claimGrant: "urn:workos:agent-auth:grant-type:claim",
  assertionGrant: "urn:ietf:params:oauth:grant-type:jwt-bearer",
} as const;
