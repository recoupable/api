import { escapeHtml } from "@/lib/emails/escapeHtml";

/**
 * Inline-style a welcome-email step thumbnail by kind:
 *   - "wide": the overlapping-avatar strip (~3.9:1) — fixed width, height auto
 *     keeps the ratio;
 *   - "square"/"rounded": a 56x56 cover (album art vs the IG post frame).
 */
export function imageTag(url: string, style: "wide" | "square" | "rounded", alt: string): string {
  const src = escapeHtml(url);
  const a = escapeHtml(alt);
  if (style === "wide") {
    return `<img src="${src}" width="132" alt="${a}" style="display:block;width:132px;height:auto;border:0"/>`;
  }
  const radius = style === "rounded" ? "12px" : "8px";
  return `<img src="${src}" width="56" height="56" alt="${a}" style="display:block;width:56px;height:56px;border-radius:${radius};object-fit:cover"/>`;
}
