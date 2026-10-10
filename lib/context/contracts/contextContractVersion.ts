/**
 * Version of the Context Engine input contract (recoupable/app#2118).
 *
 * This is the caller-facing input contract version. It is distinct from the
 * per-derivation `recipeVersion`/`schemaVersion` strings hashed by
 * `createContextReuseKey`, which fingerprint analysis inputs, not HTTP/MCP input.
 * Bump it only when the URL-only envelope changes shape or meaning.
 */
export const CONTEXT_CONTRACT_VERSION = "context-contract-v1" as const;

export type ContextContractVersion = typeof CONTEXT_CONTRACT_VERSION;
