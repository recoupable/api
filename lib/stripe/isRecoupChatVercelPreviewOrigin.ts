const RECOUP_CHAT_VERCEL_PREVIEW_ORIGIN_RE = /^https:\/\/recoup-chat-[^.]+\.vercel\.app$/i;

/**
 * Whether `origin` is a Recoup chat Vercel preview host while this deployment is a Vercel preview.
 */
export function isRecoupChatVercelPreviewOrigin(origin: string): boolean {
  if (process.env.VERCEL_ENV !== "preview") return false;
  return RECOUP_CHAT_VERCEL_PREVIEW_ORIGIN_RE.test(origin);
}
