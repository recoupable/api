// Allowed `successUrl` origins for subscription checkout (open-redirect guard).
const ALLOWED_ORIGINS = new Set([
  "https://chat.recoupable.com",
  "http://localhost:3000",
  "http://localhost:3001",
]);

const RECOUP_CHAT_PREVIEW_ORIGIN = /^https:\/\/recoup-chat-[^.]+\.vercel\.app$/i;

export function isAllowedSubscriptionCheckoutSuccessUrl(successUrl: string): boolean {
  try {
    const origin = new URL(successUrl).origin;
    if (ALLOWED_ORIGINS.has(origin)) return true;
    if (process.env.VERCEL_ENV === "preview" && RECOUP_CHAT_PREVIEW_ORIGIN.test(origin)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
