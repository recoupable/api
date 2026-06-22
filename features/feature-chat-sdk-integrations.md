# Feature: Chat SDK Integrations (Slack & GitHub)

## Overview

The coding agent feature uses the **Chat SDK** (`chat` package) to bridge Slack and GitHub into a unified conversational interface. When a user mentions the bot in Slack, it triggers a coding agent task (via Trigger.dev), tracks task state in Redis, posts PR cards back to the Slack thread, and supports merging PRs and providing feedback — all through the Chat SDK's adapter abstraction.

GitHub integration is achieved through:
- **PR state management** — shared Redis keys link GitHub PRs back to Slack threads
- **PR comment routing** — GitHub webhook events (with `repo` and `branch` metadata) resolve to existing Slack threads via the shared PR state
- **Merge actions** — Slack button actions squash-merge PRs via the GitHub API

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Chat SDK Core                           │
│                                                              │
│  Chat<{ slack: SlackAdapter }, CodingAgentThreadState>       │
│    ├── Adapters: SlackAdapter (webhook-based)                │
│    ├── State: IoRedis state adapter (thread state + PR keys) │
│    └── Handlers: onNewMention, onSubscribedMessage, onAction │
└──────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌───────────┐     ┌──────────────┐     ┌────────────────┐
   │   Slack    │     │  Trigger.dev │     │    GitHub API   │
   │  Webhooks  │     │  (task exec) │     │  (PR merging)   │
   └───────────┘     └──────────────┘     └────────────────┘
```

### Key Packages

| Package | Role |
|---------|------|
| `chat` | Core Chat SDK — `Chat` class, `Thread`, event system, singleton registry |
| `@chat-adapter/slack` | Slack adapter — webhook handling, message posting, action buttons |
| `@chat-adapter/state-ioredis` | Redis-backed thread state persistence |

---

## File Structure

### Entry Points
```
app/api/coding-agent/[platform]/route.ts     ← Slack webhook endpoint (POST)
app/api/coding-agent/callback/route.ts       ← Trigger.dev callback endpoint (POST)
```

### Bot & Configuration
```
lib/coding-agent/
├── bot.ts                                   ← Chat SDK singleton (SlackAdapter + Redis state)
├── types.ts                                 ← CodingAgentThreadState, CodingAgentPR interfaces
└── validateEnv.ts                           ← Environment variable validation
```

### Event Handlers
```
lib/coding-agent/handlers/
├── registerHandlers.ts                      ← Registers all handlers on bot singleton
├── onNewMention.ts                          ← New @mention → start task or send feedback
├── onSubscribedMessage.ts                   ← Follow-up messages in active threads
├── onMergeAction.ts                         ← "Merge All PRs" button action
└── handleFeedback.ts                        ← Busy/update-pr logic for active threads
```

### PR State Management
```
lib/coding-agent/prState/
├── index.ts                                 ← Barrel exports
├── types.ts                                 ← PRState type definitions
├── buildPRStateKey.ts                       ← Builds Redis key: repo + branch → state
├── getCodingAgentPRState.ts                 ← Read shared PR state from Redis
├── setCodingAgentPRState.ts                 ← Write shared PR state to Redis
└── deleteCodingAgentPRState.ts              ← Clean up after merge
```

### Callbacks & Cards
```
lib/coding-agent/
├── handleCodingAgentCallback.ts             ← Dispatches Trigger.dev callbacks by status
├── handlePRCreated.ts                       ← Writes thread + shared PR state, posts card
├── buildPRCard.ts                           ← Slack Block Kit card for PR links
├── buildTaskCard.ts                         ← Slack Block Kit card for task status
├── resolvePRState.ts                        ← Resolves PR state from thread or shared key
├── getThread.ts                             ← Gets Chat SDK thread by ID
└── validateCodingAgentCallback.ts           ← Validates callback payload schema
```

---

## Thread State

The Chat SDK manages per-thread state in Redis. Each coding agent thread tracks:

```typescript
interface CodingAgentThreadState {
  status: "running" | "pr_created" | "updating" | "merged" | "failed" | "no_changes";
  prompt: string;
  runId?: string;           // Trigger.dev run ID
  slackThreadId?: string;   // Slack thread reference
  branch?: string;          // Git branch name
  snapshotId?: string;      // Sandbox snapshot for updates
  prs?: CodingAgentPR[];    // Created PRs
}

interface CodingAgentPR {
  repo: string;    // e.g. "recoupable/api"
  number: number;  // PR number
  url: string;     // Full GitHub PR URL
  baseBranch: string;
}
```

### Dual-Key State Strategy

State is stored in **two places** to enable cross-platform lookups:

1. **Thread state** (Chat SDK) — keyed by Slack thread ID, for in-thread interactions
2. **Shared PR state** (custom Redis keys) — keyed by `repo:branch`, for GitHub webhook lookups

This allows GitHub PR comment events (which carry `repo` + `branch` but not a Slack thread ID) to resolve back to the correct Slack thread.

---

## Slack Integration

### Bot Initialization

The bot is a **Chat SDK singleton** created in `bot.ts`:

```typescript
const slack = new SlackAdapter({
  botToken: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const bot = new Chat<{ slack: SlackAdapter }, CodingAgentThreadState>({
  userName: "Recoup Agent",
  adapters: { slack },
  state: createIoRedisState({ client: redis, keyPrefix: "coding-agent" }),
});

export const codingAgentBot = bot.registerSingleton();
```

### Webhook Routing

`POST /api/coding-agent/slack` handles:
- **`url_verification`** — Slack challenge/response (fast path, no Redis needed)
- **All other events** — delegated to `codingAgentBot.webhooks.slack()`

### Event Handlers

| Handler | Trigger | Behavior |
|---------|---------|----------|
| `onNewMention` | Bot @mentioned | If thread has PRs → feedback/update. Otherwise → start new Trigger.dev task |
| `onSubscribedMessage` | Message in subscribed thread | Delegates to feedback handler (busy check, update-pr) |
| `onAction("merge_all_prs")` | Button click | Squash-merges all PRs via GitHub API, cleans up state |

---

## GitHub Integration

GitHub is integrated **indirectly** through the coding agent pipeline rather than as a Chat SDK adapter:

### PR Creation Flow
1. Trigger.dev task creates PRs on GitHub
2. Callback hits `POST /api/coding-agent/callback` with `status: "pr_created"`
3. `handlePRCreated()` writes PR details to both thread state and shared PR state
4. Bot posts a Slack Block Kit PR card with links and a "Merge All PRs" button

### PR Comment → Slack Thread Resolution
1. GitHub webhook delivers a PR comment event
2. The event includes `repo` and `branch` in `message.meta`
3. `resolvePRState()` checks thread state first, falls back to shared PR state key (`repo:branch`)
4. If found → treats the comment as feedback and triggers an update-pr task

### PR Merging
1. User clicks "Merge All PRs" button in Slack
2. `onMergeAction` iterates over `state.prs[]`
3. Each PR is squash-merged via `PUT /repos/{owner}/{repo}/pulls/{number}/merge`
4. Thread state updated to `"merged"`, shared PR state key deleted

---

## Callback Flow (Trigger.dev → Slack)

```
Trigger.dev Task
       │
       ▼
POST /api/coding-agent/callback
  (x-callback-secret auth)
       │
       ├── status: "pr_created"  → handlePRCreated() → post PR card, write dual state
       ├── status: "updated"     → post updated PR card, refresh state + shared key
       ├── status: "no_changes"  → post "no changes" message
       └── status: "failed"      → post error message
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SLACK_BOT_TOKEN` | Slack Bot OAuth token for posting messages |
| `SLACK_SIGNING_SECRET` | Verifies Slack webhook signatures |
| `GITHUB_TOKEN` | GitHub PAT for merging PRs |
| `CODING_AGENT_CALLBACK_SECRET` | Shared secret for Trigger.dev callback auth |
| Redis connection (via `lib/redis/connection`) | Thread state + PR state persistence |

---

## Key Design Decisions

### 1. Chat SDK as Abstraction Layer
The Chat SDK provides a platform-agnostic interface (`Thread.post()`, `Thread.setState()`, `Thread.subscribe()`) so the coding agent logic doesn't couple directly to Slack's API. Adding a new platform (e.g., Discord) would mean adding a new adapter, not rewriting handlers.

### 2. Singleton Pattern
The bot registers as a singleton (`registerSingleton()`) so `ThreadImpl` can lazily resolve adapters from thread IDs anywhere in the codebase — critical for the callback route, which needs to post to threads without re-initializing the bot.

### 3. Dual-Key State for Cross-Platform Resolution
Thread state alone isn't sufficient because GitHub events don't carry Slack thread IDs. The shared `repo:branch` PR state key bridges this gap, enabling GitHub → Slack thread resolution.

### 4. Webhook-First Architecture
Both Slack and Trigger.dev communicate via webhooks to the API. No long-lived connections or WebSockets — everything is stateless HTTP + Redis state, which fits naturally into Next.js serverless.

### 5. Fast Path for Slack Challenge
The `url_verification` challenge is handled before any Redis/bot initialization to avoid timeouts during Slack app setup.

---

## Modification Guide

| Want to change... | Modify this file |
|-------------------|------------------|
| Bot name or adapter config | `lib/coding-agent/bot.ts` |
| What happens on @mention | `lib/coding-agent/handlers/onNewMention.ts` |
| Feedback/busy logic | `lib/coding-agent/handlers/handleFeedback.ts` |
| PR card layout (Slack blocks) | `lib/coding-agent/buildPRCard.ts` |
| Task card layout | `lib/coding-agent/buildTaskCard.ts` |
| Merge behavior | `lib/coding-agent/handlers/onMergeAction.ts` |
| Callback dispatch logic | `lib/coding-agent/handleCodingAgentCallback.ts` |
| PR state key structure | `lib/coding-agent/prState/buildPRStateKey.ts` |
| Thread state schema | `lib/coding-agent/types.ts` |
| Env var requirements | `lib/coding-agent/validateEnv.ts` |
