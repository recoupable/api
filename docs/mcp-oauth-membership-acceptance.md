# Delegated organization membership transition

The controlled acceptance test in
`lib/mcp/oauth/__tests__/membershipLoss.test.ts` composes the actual
`registerFullOAuthTools` wrapper with `prepareFullOAuthTool`. A synthetic verifier
keeps the same full-scope grant valid throughout. A mocked membership source first
permits two workspaces, then removes one. The next call to the removed workspace
fails before either the execution hook or business operation runs, while the
retained workspace remains usable. Both organization parameter spellings are
covered with synthetic business registrations and operations.

Run with:

```sh
pnpm test lib/mcp/oauth/__tests__/membershipLoss.test.ts lib/mcp/oauth/__tests__/registerFullOAuthTools.test.ts lib/mcp/oauth/__tests__/prepareFullOAuthTool.test.ts
```

This is source-level acceptance for Mono #207 J8 and #212/#214. It does not prove
production membership propagation, role-level permissions, per-connection selected
organization grants, real token lifecycle, actual business writes, or named-client
behavior. Rate limiting and database/provider boundaries are mocked; no live
membership or access changes are required. It complements the existing static
resource-denial and grant-revocation tests without changing runtime authorization.

October 24, 2026: both transition cases pass. Temporarily bypassing the membership
denial guard makes both cases fail; the mutation is restored and is not committed.
Live intended-account and named-client acceptance remain separate launch gates.
