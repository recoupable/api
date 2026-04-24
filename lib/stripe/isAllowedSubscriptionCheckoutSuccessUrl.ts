/**
 * Origins allowed for `successUrl` on subscription checkout (open-redirect guard).
 * Keep in sync with chat hosts; extend here when new first-party app origins are added.
 */
const SUBSCRIPTION_CHECKOUT_SUCCESS_ALLOWED_ORIGINS = [
  "https://chat.recoupable.com",
  "http://localhost:3000",
  "http://localhost:3001",
] as const;

/** Vercel preview URLs for the chat app (origin only, e.g. …vercel.app). */
const RECOUP_CHAT_VERCEL_PREVIEW_ORIGIN_RE =
  /^https:\/\/recoup-chat-[^.]+\.vercel\.app$/i;

function extraOriginsFromEnv(): string[] {
  const raw = process.env.SUBSCRIPTION_CHECKOUT_SUCCESS_EXTRA_ORIGINS;
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function isRecoupChatVercelPreviewOrigin(origin: string): boolean {
  if (process.env.VERCEL_ENV !== "preview") return false;
  return RECOUP_CHAT_VERCEL_PREVIEW_ORIGIN_RE.test(origin);
}

/**
 * Returns whether `successUrl` uses an allowed origin for post-checkout redirect.
 */
export function isAllowedSubscriptionCheckoutSuccessUrl(successUrl: string): boolean {
  try {
    const origin = new URL(successUrl).origin;
    if ((SUBSCRIPTION_CHECKOUT_SUCCESS_ALLOWED_ORIGINS as readonly string[]).includes(origin)) {
      return true;
    }
    if (extraOriginsFromEnv().includes(origin)) {
      return true;
    }
    if (isRecoupChatVercelPreviewOrigin(origin)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
