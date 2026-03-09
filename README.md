# Recoup API

Next.js 16 API service powering the Recoup platform — AI agents, artist management, chat, payments, and the coding agent bot.

## Prerequisites

- Node.js v22+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))

## Setup

```bash
pnpm install
pnpm dev
```

## Chat SDK Integrations (Slack & GitHub)

The **coding agent** uses the [Chat SDK](https://github.com/vercel/chat) (`chat` + `@chat-adapter/slack`) to bridge Slack conversations with GitHub workflows.

### Architecture

```
Slack (mentions / threads)
  ↕  SlackAdapter (Chat SDK)
  ↕  codingAgentBot singleton  ─── lib/coding-agent/bot.ts
  │
  ├─ onNewMention       → triggers Trigger.dev coding-agent task
  ├─ onSubscribedMessage → handles follow-ups in active threads
  └─ onMergeAction       → processes PR merge requests
  │
  ↕  Trigger.dev callbacks  ─── POST /api/coding-agent/callback
  │
  ├─ pr_created  → posts PR card to Slack thread, persists state
  ├─ updated     → posts updated PR card
  ├─ no_changes  → notifies thread
  └─ failed      → notifies thread with error
  │
  ↕  GitHub PR context
      onNewMention reads message.meta { repo, branch } from GitHub PR comments
      resolvePRState() checks thread state + shared Redis PR state key
      handleFeedback() routes follow-ups to the update-pr task when PRs exist
```

### State Management

Thread state (`CodingAgentThreadState`) is persisted in Redis via `@chat-adapter/state-ioredis`, keyed by thread ID. A separate shared PR state key (`coding-agent:pr:<repo>:<branch>`) enables cross-thread PR lookups — for example, when a GitHub PR comment arrives without existing Slack thread state.

### Webhook Endpoints

| Route | Purpose |
|---|---|
| `POST /api/coding-agent/[platform]` | Incoming webhooks from Slack (events, interactions) |
| `POST /api/coding-agent/callback` | Trigger.dev task result callbacks |

### Environment Variables

| Variable | Description |
|---|---|
| `SLACK_BOT_TOKEN` | Slack bot OAuth token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Slack app signing secret (verifies webhook requests) |
| `GITHUB_TOKEN` | GitHub PAT for repo operations and PR creation |
| `REDIS_URL` | Redis connection URL (thread state storage) |
| `CODING_AGENT_CALLBACK_SECRET` | Shared secret for Trigger.dev → API callback auth |

### Updating Testing Variables

When pointing the coding agent at a different environment (e.g. staging, a preview deploy, or local dev), you need to update external service URLs so webhooks reach the correct API instance.

#### Slack — Subscription Events & Interactivity

Slack sends events and interactions to URLs configured in your Slack app settings:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → select your app
2. **Event Subscriptions** → update the **Request URL** to:
   ```
   https://<your-api-host>/api/coding-agent/slack
   ```
3. **Interactivity & Shortcuts** → update the **Request URL** to the same endpoint:
   ```
   https://<your-api-host>/api/coding-agent/slack
   ```
4. Slack will send a `url_verification` challenge — the endpoint handles this automatically.

> **Tip:** For local development, use a tunnel (e.g. `ngrok`, `cloudflared`) to expose your local server, then set the tunnel URL as the request URL in both places.

#### Trigger.dev — Callback URL

The coding-agent Trigger.dev task posts results back to the API via the callback endpoint. Update the callback URL in your Trigger.dev task configuration or environment:

- Set the callback URL to:
  ```
  https://<your-api-host>/api/coding-agent/callback
  ```
- Ensure `CODING_AGENT_CALLBACK_SECRET` matches between the Trigger.dev task environment and the API's `.env` so callback requests are authenticated.

## x402 Payment Middleware

The API uses `x402-next` middleware for crypto payments on Base network. See `middleware.ts` and `lib/x402/` for configuration.

## Build Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server
pnpm build          # Production build
pnpm test           # Run vitest
pnpm test:watch     # Watch mode
pnpm lint           # Fix lint issues
pnpm lint:check     # Check for lint issues
pnpm format         # Run prettier
pnpm format:check   # Check formatting
```
