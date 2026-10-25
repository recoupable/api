# Recoup API

Next.js 16 API service for Recoup's artist, account, chat and agent workflows. Routes live in `app/api/`; domain logic lives in `lib/`. Database access belongs in `lib/supabase/`.

## Local development

Use Node.js 22 and pnpm 9 (the Node 22 compatibility workflow uses pnpm 9). From this repository:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Configure only the services required by your work through an ignored local environment file or your deployment's secret configuration. This repository is an API service, not the old x402 example workspace: no parent-directory build or Ethereum wallet is required just to install dependencies. Starting routes that import service clients can require their configuration and connect to providers.

For the coding-agent integration, follow [Coding-agent setup](docs/coding-agent-setup.md) before starting or exposing its routes. That guide covers Slack, GitHub, optional WhatsApp, Redis state and the existing Trigger.dev callback contract.

## Commands

These are the scripts in [package.json](package.json):

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Build the MCP extension, then start Next.js development mode |
| `pnpm build` | Build the extension and Next.js, then check the OAuth provider build |
| `pnpm test` | Build the extension, then run Vitest |
| `pnpm test:watch` | Build the extension, then start Vitest watch mode |
| `pnpm lint` / `pnpm lint:check` | Run ESLint with / without fixes |
| `pnpm format` / `pnpm format:check` | Format / check supported source and Markdown files |

## Architecture and guides

- [Contributor instructions](AGENTS.md): authentication, validation, database boundaries and PR workflow. New PRs target `main`; the old `test` staging flow is retired.
- [Coding-agent setup](docs/coding-agent-setup.md): current webhook, callback and shared-state behavior.
- [MCP OAuth runtime](docs/mcp-oauth-runtime.md): OAuth discovery, consent and delegated access.
- [Response contracts](lib/contracts/README.md): shared schemas and published contract checks.
- [proxy.ts](proxy.ts) and [lib/x402/](lib/x402/): request middleware and x402 payment integration. Consult these sources for protected routes and payment behavior.

New background/scheduled platform work uses Vercel Workflows inside this API. The coding-agent and update-pr integrations documented here still call existing Trigger.dev tasks; documenting them does not migrate or deploy those workers.
