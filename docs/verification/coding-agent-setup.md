# Coding-agent setup documentation scope

Original source baseline: API `018779985065557367e60e7622206995747c8783`. Adapter contracts were inspected at the lockfile versions: `chat`, Slack and GitHub adapters 4.15.0; WhatsApp adapter 4.20.0. API #1149 updates the initialization note for its lazy dynamic routes and distinct-adapter regression coverage, composed with this guide's actual merge on main. This is source/test evidence, not release or hosted acceptance.

This successor addresses the documentation portions of existing [API #273](https://github.com/recoupable/api/pull/273) and [API #289](https://github.com/recoupable/api/pull/289). It replaces the x402-example README with repository setup/commands and a linked coding-agent guide. It does not accept the original PRs as a whole.

| Original documentation requirement | Current source / treatment |
| --- | --- |
| Recoup setup and build commands | `package.json` and the Node 22 compatibility workflow; README uses repository-root commands |
| SDK platforms, webhook URLs and initialization | `lib/coding-agent/bot.ts`, `app/api/coding-agent/[platform]/route.ts`, `lib/agents/createPlatformRoutes.ts`, and the concrete GitHub route/handler; static route precedence, fixed mention name, event subscriptions, dynamic-route guards and remaining callback/static ingress startup effects remain explicit |
| Required configuration and callback-secret matching | `lib/coding-agent/validateEnv.ts`, `handleCodingAgentCallback.ts`; exact names, no credential values |
| Optional WhatsApp setup | `whatsApp/isWhatsAppConfigured.ts` and locked adapter; all four or none, Meta GET/POST distinction |
| Callback destination / payload | API wrappers pass `callbackThreadId`; validator requires `threadId` and status; API has no `TRIGGER_CALLBACK_URL` consumer |
| Redis/shared PR state and feedback | `lib/agents/createAgentState.ts`, `resolvePRState.ts`, `prState/`, handlers; first-PR repository and best-effort cleanup are explicit |

The local verification is provider-free: check relative links/source paths, documented scripts and environment names, validate the synthetic callback JSON against the real schema, inspect the locked adapter's GET/signature behavior, and run the existing mocked environment/callback/state/route cases relevant to these statements. ESLint and formatting checks apply before commit; exact-head CI is recorded in the PR.

Remaining requirements stay with existing owners:

- API #273/#274 documentation owner: review the new current-source setup guidance against the original documentation scope; no deployment acceptance is implied.
- API #289 coding-agent owner: API #1149 supplies mocked WhatsApp GET verification and distinct-adapter POST dispatch assertions; live Meta setup/message acceptance remains separate. A deliberate WhatsApp-to-Slack dispatch mutation fails the existing strengthened case.
- API #297/#264 initialization owner: API #1149 supplies the bounded lazy dynamic-route implementation and cold-import tests. Exact source composition, merge/release and hosted acceptance remain distinct; this guide does not establish a production deployment.
- API #264 coding-agent owner: explicit disposition of historical allowlists/configuration and their regression slice remains required. Current behavior is documented without inventing or restoring policy.
- Existing integration owners retain provider permissions, callback/worker deployment, Redis connection, real thread identity and authorized merge acceptance. No real registration, event, callback, message, task, Redis connection or provider operation is part of this documentation verification.
