# x402-next Example App

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

## Testing Resend Email Integration

The coding agent supports email conversations via Resend. To test this integration:

### 1. Configure Environment Variables

Ensure these environment variables are set in your `.env`:

```bash
RESEND_API_KEY=re_your_api_key_here
# Optional: for webhook signature verification
RESEND_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 2. Set Up Resend Webhook

In your [Resend dashboard](https://resend.com/dashboard/webhooks):

1. Create a new webhook
2. Set the endpoint URL to: `https://<your-host>/api/coding-agent/resend`
3. Select events: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`
4. Copy the webhook signing secret and set it as `RESEND_WEBHOOK_SECRET`

### 3. Send a Test Email

Send an email to `agent@recoupable.com` with:
- **Subject**: Your request (e.g., "Fix the login bug")
- **Body**: Detailed description of what you want the coding agent to do

The coding agent will:
1. Receive the email via Resend webhook
2. Create a new thread (same as a Slack mention)
3. Process your request
4. Reply via email with the results

### 4. Test Reply Threading

Reply to the agent's email to continue the conversation. The email threading uses standard `Message-ID` and `In-Reply-To` headers, so replies are automatically grouped into the same Chat SDK thread.

### 5. Local Development with ngrok

For local testing, use [ngrok](https://ngrok.com/) to expose your local server:

```bash
# Terminal 1: Start the dev server
pnpm dev

# Terminal 2: Expose via ngrok
npx ngrok http 3000

# Update Resend webhook URL to: https://<ngrok-id>.ngrok.io/api/coding-agent/resend
```

### 6. Verify in Logs

Check the server logs for:
- `POST /api/coding-agent/resend` — Webhook received
- `Syncing monorepo submodules` — Submodule sync before changes
- `Agent completed` — Coding agent finished
- Email sent confirmation via Resend