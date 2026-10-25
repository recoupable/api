# Coding-agent setup

This guide started from API source at `018779985065557367e60e7622206995747c8783` (October 25, 2026); its initialization notes include the source repair in [API #1149](https://github.com/recoupable/api/pull/1149). It is configuration guidance, not evidence of an installed or working provider integration. The [source and acceptance record](verification/coding-agent-setup.md) identifies remaining requirements.

## Configuration

The [bot factory](../lib/coding-agent/bot.ts) registers Slack and GitHub adapters and conditionally adds WhatsApp. [Environment validation](../lib/coding-agent/validateEnv.ts) requires these six nonempty values whenever this bot is constructed, including the dynamic platform and callback routes. The separate static GitHub ingress does not call that validator, but its eventual callback still needs the configured bot:

| API variable | Meaning |
| --- | --- |
| `SLACK_BOT_TOKEN` | Bot token for the Slack app receiving coding-agent events |
| `SLACK_SIGNING_SECRET` | That Slack app's signing secret |
| `GITHUB_TOKEN` | GitHub token used by the adapter and PR merge operations |
| `GITHUB_WEBHOOK_SECRET` | Secret matching the GitHub webhook configuration |
| `REDIS_URL` | Redis connection URL for thread and shared PR state |
| `CODING_AGENT_CALLBACK_SECRET` | Secret expected in the worker's `x-callback-secret` header |

`GITHUB_BOT_USERNAME` configures the SDK adapter and defaults to `recoup-coding-agent`, but it does **not** change the public GitHub webhook's mention parser. That endpoint currently requires the literal `@recoup-coding-agent` in comments. Variable presence checks do not verify permissions, provider installation or credential validity.

Use your approved secret configuration for real values; do not commit them. The [Redis connection](../lib/redis/connection.ts) currently parses host, port and password from `REDIS_URL`; it does not forward a URL username or configure TLS from a `rediss:` scheme. Confirm compatibility with the existing Redis deployment rather than assuming every Redis URL works.

The API's [coding-agent](../lib/trigger/triggerCodingAgent.ts) and [update-pr](../lib/trigger/triggerUpdatePR.ts) wrappers call the Trigger.dev SDK. They need its authorized environment/project configuration in addition to the six bot variables. The bot validator does not validate the worker deployment or SDK credentials. These are existing legacy worker integrations; new platform jobs use API Workflows.

### Optional WhatsApp

Set **all four** variables below to enable WhatsApp, or leave **all four unset** to omit it. Any partial set fails bot validation; these are not mandatory for Slack/GitHub-only configuration.

| API variable | Meaning |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API access token |
| `WHATSAPP_APP_SECRET` | Meta app secret used to verify webhook signatures |
| `WHATSAPP_PHONE_NUMBER_ID` | Business phone number ID, not its display phone number |
| `WHATSAPP_VERIFY_TOKEN` | Value you choose to match Meta's webhook verification token |

The [configuration helper](../lib/coding-agent/whatsApp/isWhatsAppConfigured.ts) defines the four-variable group. The installed `@chat-adapter/whatsapp` adapter reads these values; its optional `WHATSAPP_BOT_USERNAME` defaults to `whatsapp-bot` and does not affect the four-variable enablement check.

## Webhook destinations

Replace `api.example.com` with the intended API host. These URLs are placeholders, not commands to register or send events.

| Platform | Method and destination | Verification |
| --- | --- | --- |
| Slack | `POST https://api.example.com/api/coding-agent/slack` | App-specific Slack signature; signed setup challenge |
| GitHub | `POST https://api.example.com/api/coding-agent/github` | Static GitHub route validates `x-hub-signature-256` with `GITHUB_WEBHOOK_SECRET` |
| WhatsApp | `GET` and `POST https://api.example.com/api/coding-agent/whatsapp` | GET verify-token challenge; POST app-secret signature |
| Worker callback | `POST https://api.example.com/api/coding-agent/callback` | `x-callback-secret` matching `CODING_AGENT_CALLBACK_SECRET` |

### Slack

In the intended Slack app, set both the Event Subscriptions Request URL and the Interactivity & Shortcuts Request URL to the Slack destination above. Use the app corresponding to `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET`; the separate content/chat agents have different routes and signing secrets.

The setup challenge must carry Slack's signature and timestamp. [Challenge verification](../lib/slack/handleUrlVerification.ts) returns 401 for an invalid signature; ordinary events continue to the adapter. Existing [verification notes](verification/slack-webhook-verification.md) describe the raw-body and timestamp checks. App installation, scopes, event subscriptions and actual delivery still need provider-side verification by the integration owner.

### GitHub

Configure the intended repository webhook with the GitHub destination, JSON content type and the matching `GITHUB_WEBHOOK_SECRET`. In the webhook event selection, explicitly enable **Issue comments** (`issue_comment`) and **Pull request review comments** (`pull_request_review_comment`); leaving the default push-only selection will not deliver PR feedback.

The concrete [GitHub route](../app/api/coding-agent/github/route.ts) takes precedence over `[platform]` and calls [handleGitHubWebhook](../lib/coding-agent/handleGitHubWebhook.ts), not the generic SDK webhook. Its [comment parser](../lib/coding-agent/extractPRComment.ts) accepts only newly created PR comments containing the literal `@recoup-coding-agent`, regardless of `GITHUB_BOT_USERNAME`. Signed unsupported events, including `ping` and `push`, return `status: ignored`.

This endpoint updates existing work; it does not start a new coding-agent task. It looks up shared PR state by repository and branch, fetching the PR branch through GitHub when an issue-comment event omits it. Missing state/snapshot/PRs returns `no_state`; running/updating state returns `busy`. Eligible feedback marks shared state updating and triggers `update-pr`, restoring the prior state if the trigger fails. Its acknowledgement is best effort after the trigger. Token repository access and pre-existing shared PR state must therefore be verified by the integration owner.

### WhatsApp

In the Meta app's WhatsApp webhook configuration, set the Callback URL to the WhatsApp destination and the Verify token to the same value as `WHATSAPP_VERIFY_TOKEN`. Subscribe the relevant WhatsApp business account to message notifications (`messages`). The adapter processes changes whose field is `messages`.

Meta verifies the URL with GET parameters `hub.mode=subscribe`, `hub.verify_token` and `hub.challenge`. The shared route mirrors the locked adapter's verification: return the challenge with 200 when mode and token match, otherwise 403, without constructing the bot. POST events require `x-hub-signature-256` signed with `WHATSAPP_APP_SECRET`. Do not put access tokens or app secrets in the callback URL. When WhatsApp is omitted, its route returns 404 before bot initialization.

## Initialization limits

For the dynamic Slack/WhatsApp route, the [shared platform helper](../lib/agents/createPlatformRoutes.ts) checks supported platforms and signatures before lazily importing the bot and registered handlers. Signed Slack setup challenges and WhatsApp GET verification complete without bot or Redis startup. Ordinary signed events keep their original request bodies and delegate initialization to the SDK webhook. The SDK initializes its shared state/adapters once; the route does not call `bot.initialize()` separately.

The [coding-agent dynamic route](../app/api/coding-agent/[platform]/route.ts) can therefore load and reject unsupported/unsigned requests without constructing its bot, state or adapters. Valid ordinary events still require the configured bot and Redis. This boundary does not cover every entrypoint: the callback route initializes the bot before its handler validates the callback secret/body. The separate static GitHub route imports shared Redis helpers, so it is not guaranteed to load without Redis configuration either. Source and mocked tests do not prove production configuration, persistence or delivery.

## Worker callback contract

Configure the existing worker's callback destination as `https://api.example.com/api/coding-agent/callback`. It must send `x-callback-secret` with the same value configured as `CODING_AGENT_CALLBACK_SECRET` in the API. When switching API environments, update both the worker destination and matching secret through the owning deployment workflow. The API wrappers pass `callbackThreadId`; they do not read `TRIGGER_CALLBACK_URL` or select a callback host. Do not assume setting that variable in the API redirects worker callbacks.

The [callback schema](../lib/coding-agent/validateCodingAgentCallback.ts) requires `threadId` and one of `pr_created`, `updated`, `no_changes`, `failed`. Preserve the originating SDK thread ID passed to the worker as `callbackThreadId`; `thread_ts` and `channel` are not this schema's required fields.

Example JSON for a successful PR result (synthetic identifiers only; not a live request):

```json
{
  "threadId": "slack:C_EXAMPLE:1700000000.000001",
  "status": "pr_created",
  "branch": "codex/example-change",
  "snapshotId": "snapshot-example",
  "prs": [
    {
      "repo": "example/project",
      "number": 1,
      "url": "https://github.com/example/project/pull/1",
      "baseBranch": "main"
    }
  ]
}
```

The schema makes `branch`, `snapshotId` and `prs` optional, but later feedback requires all three and a nonempty PR list. Optional `message`, `stdout` and `stderr` are also accepted. The [handler](../lib/coding-agent/handleCodingAgentCallback.ts) posts nonempty stdout to the thread; worker output must be suitable for that destination.

Once initialization succeeds, the handler returns 401 for a missing/wrong callback secret, 400 for invalid JSON/schema, and `{ "status": "ok" }` on successful handling. Provider/state failures can prevent success; this is not a delivery guarantee.

## Thread and PR state

- A new mention first checks existing state for busy/feedback handling. Otherwise it subscribes, triggers `coding-agent`, posts its acknowledgement **after** the task trigger, and stores running state with the returned run ID.
- Thread state uses the Chat SDK Redis adapter with the `coding-agent` key prefix. Shared PR state separately uses `coding-agent:pr:<repo>:<branch>` via [PR-state helpers](../lib/coding-agent/prState/).
- [State resolution](../lib/coding-agent/resolvePRState.ts) prefers existing thread state. It consults shared PR state only when thread state is absent and a caller supplies both repository and branch. The mention handler reads those fields from `message.raw`; it does not guarantee every adapter event includes them.
- `pr_created` stores thread state and, when a branch and PR exist, shared state under the **first PR's repository**. `updated` preserves existing PRs, updates snapshot/status and refreshes that shared key. `no_changes` and `failed` reset thread status.
- Feedback requires `pr_created`, snapshot, branch and PRs; it marks state updating and triggers `update-pr`. Running/updating threads receive a busy response.
- Current actions merge individual PRs found in the thread state. After the last PR is removed, [post-merge handling](../lib/coding-agent/handleMergeSuccess.ts) attempts shared-state cleanup and snapshot persistence; it catches/logs failures. This is best effort, not atomic cleanup.

Legacy code still contains a test-to-main follow-up action. New Recoup PRs target `main` under [AGENTS.md](../AGENTS.md); this documentation does not recommend reviving the retired staging flow. The historical channel/account allowlist proposal is not enforced by the current mention handler. Do not treat old configuration names or shared PR state as an authorization policy.

## Acceptance still required

Source checks cannot establish live Slack/GitHub/Meta registration, token permissions, Redis compatibility, worker configuration, signed delivery, callback posting or merge authorization. Keep those with the existing integration owners. API #1149 supplies bounded cold-module and WhatsApp-specific mocked route coverage; it does not close the original PRs as a whole or decide the historical allowlist policy.
