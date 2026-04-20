# x402-next Example App

```js
console.log("Hello from the Recoup API 🎵");
```

This is a Next.js application that demonstrates how to use the `x402-next` middleware to implement paywall functionality in your Next.js routes.

## Prerequisites

- Node.js v22+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))
- A valid Ethereum address for receiving payments

## Setup

1. Copy `.env.local` to `.env` and add your Ethereum address to receive payments:

```bash
cp .env.local .env
```

2. Install and build all packages from the typescript examples root:
```bash
cd ../../
pnpm install
pnpm build
cd fullstack/mainnet
```

2. Install and start the Next.js example:
```bash
pnpm dev
```

## Example Routes

The app includes protected routes that require payment to access:

### Protected Page Route
The `/protected` route requires a payment of $0.001 to access. The route is protected using the x402-next middleware:

```typescript
// middleware.ts
import { paymentMiddleware, Network, Resource } from "x402-next";
import { facilitator } from "@coinbase/x402";

const payTo = process.env.RESOURCE_WALLET_ADDRESS as Address;

export const middleware = paymentMiddleware(
  payTo,
  {
    "/protected": {
      price: "$0.001",
      network: "base",
      config: {
        description: "Access to protected content",
      },
    },
  },
  facilitator
);

// Configure which paths the middleware should run on
export const config = {
  matcher: ["/protected/:path*"],
  runtime: "nodejs",
};
```

## Response Format

### Payment Required (402)
```json
{
  "error": "X-PAYMENT header is required",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "1000",
    "resource": "http://localhost:3000/protected",
    "description": "Access to protected content",
    "mimeType": "",
    "payTo": "0xYourAddress",
    "maxTimeoutSeconds": 60,
    "asset": "0x...",
    "outputSchema": null,
    "extra": null
  }
}
```

### Successful Response
```ts
// Headers
{
  "X-PAYMENT-RESPONSE": "..." // Encoded response object
}
```

## Extending the Example

To add more protected routes, update the middleware configuration:

```typescript
export const middleware = paymentMiddleware(
  payTo,
  {
    "/protected": {
      price: "$0.001",
      network: "base",
      config: {
        description: "Access to protected content",
      },
    },
    "/api/premium": {
      price: "$0.01",
      network: "base",
      config: {
        description: "Premium API access",
      },
    },
  }
);

export const config = {
  matcher: ["/protected/:path*", "/api/premium/:path*"],
  runtime: "nodejs",
};
```

## Chat SDK Integrations

The API uses the [Chat SDK](https://github.com/vercel/chat) to integrate with external platforms via a unified adapter pattern.

### Architecture

```
Slack (events/messages)
  └─▶ POST /api/coding-agent/slack    ← Slack webhook (subscription events + interactivity)
        └─▶ Chat SDK (SlackAdapter)
              └─▶ Handler dispatches Trigger.dev task
                    └─▶ POST /api/coding-agent/callback  ← Trigger.dev callback URL
                          └─▶ Posts result back to Slack thread

GitHub (webhooks)
  └─▶ PR events, repo operations
        └─▶ lib/github/* helpers (file trees, submodules, repo management)
```

- **Slack adapter** — Receives messages via Slack's Events API, processes them through Chat SDK handlers, and triggers coding agent tasks via Trigger.dev. Results are posted back to the originating Slack thread.
- **GitHub integration** — Manages repo operations (file trees, submodules, PRs) used by the coding agent to create and update pull requests.
- **State** — Thread state (status, run IDs, PRs) is stored in Redis via the Chat SDK's ioredis state adapter.

### Updating Testing/Dev URLs

When deploying to a new environment (e.g. preview branches, local dev via ngrok), you need to update callback URLs in two places:

#### Slack — Subscription Events & Interactivity

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → select your app
2. **Event Subscriptions** → Update the Request URL to:
   ```
   https://<your-host>/api/coding-agent/slack
   ```
3. **Interactivity & Shortcuts** → Update the Request URL to the same endpoint:
   ```
   https://<your-host>/api/coding-agent/slack
   ```
4. Slack will send a `url_verification` challenge — the route handles this automatically.

#### Trigger.dev — Callback URL

The coding agent task calls back to the API when it finishes. Update the callback URL environment variable so it points to your current deployment:

```
TRIGGER_CALLBACK_URL=https://<your-host>/api/coding-agent/callback
```

Set this in your `.env` (local) or in your hosting provider's environment variables (Vercel, etc.).

## Accessing Mainnet

To access the mainnet facilitator in Next.js, simply install and use the `@coinbase/x402` package. 