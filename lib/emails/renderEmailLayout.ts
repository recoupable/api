export type EmailLayoutCta = {
  /** Button label. */
  label: string;
  /** Absolute URL the button links to. */
  url: string;
};

export type RenderEmailLayoutParams = {
  /** The email's main content, already rendered to HTML. */
  bodyHtml: string;
  /** Optional footer HTML (reply note, chat link, artist attribution). */
  footerHtml?: string;
  /** Optional primary call-to-action rendered as a button below the body. */
  cta?: EmailLayoutCta;
};

// Brand tokens (DESIGN.md §3) — kept literal because email clients can't read
// CSS custom properties. Achromatic chrome; color comes from content.
const INK = "#0a0a0a"; // --foreground
const MUTED_INK = "#6b6b6b"; // --muted-foreground
const PAGE_BG = "#f7f7f7"; // --muted (page canvas)
const CARD_BG = "#ffffff"; // --card
const BORDER = "#e8e8e8"; // --border
const CTA_BG = "#0a0a0a"; // --primary
const CTA_FG = "#ffffff"; // --primary-foreground

// UI font stack — Plus Jakarta Sans (DESIGN.md four-font system) with system
// fallbacks for clients that can't load a webfont.
//
// Font names are SINGLE-quoted on purpose: this stack is interpolated into
// double-quoted `style="…"` attributes, so double quotes here would terminate
// the attribute early — silently dropping the font (clients fall back to
// serif) and every declaration after it.
const FONT_STACK =
  "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Shadow-as-border (DESIGN.md) — a hairline outline + subtle elevation via
// box-shadow instead of a CSS `border` on the card.
const CARD_SHADOW = `box-shadow: 0px 0px 0px 1px ${BORDER}, 0px 2px 4px rgba(0,0,0,0.04);`;

/**
 * Shared house-style wrapper for all onboarding emails (welcome, valuation,
 * weekly report — recoupable/chat#1885 consistency pass). Wraps a rendered
 * body in one header + footer + CTA structure so every automated email reads
 * as one family: achromatic chrome, shadow-as-border card, the Recoup wordmark
 * header, and the DESIGN.md font stack.
 *
 * Email-client-safe: all styles inline, a centered fixed-max-width container,
 * literal hex tokens (no CSS variables), and webfonts degrade to system fonts.
 */
export function renderEmailLayout({ bodyHtml, footerHtml, cta }: RenderEmailLayoutParams): string {
  const header = `
<div style="padding:0 0 20px;">
  <span style="font-family:${FONT_STACK};font-weight:700;font-size:18px;letter-spacing:-0.02em;color:${INK};">Recoup</span>
</div>`.trim();

  const ctaBlock = cta
    ? `
<div style="padding:24px 0 4px;">
  <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
     style="display:inline-block;background:${CTA_BG};color:${CTA_FG};font-family:${FONT_STACK};font-weight:600;font-size:14px;text-decoration:none;padding:12px 20px;border-radius:8px;">
    ${cta.label}
  </a>
</div>`.trim()
    : "";

  const footerBlock = footerHtml
    ? `
<div style="padding-top:24px;margin-top:24px;">
  ${footerHtml}
</div>`.trim()
    : "";

  return `
<div style="background:${PAGE_BG};padding:32px 16px;font-family:${FONT_STACK};color:${INK};">
  <div style="max-width:560px;margin:0 auto;background:${CARD_BG};border-radius:12px;${CARD_SHADOW}padding:32px;">
    ${header}
    <div style="font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${INK};">
      ${bodyHtml}
    </div>
    ${ctaBlock}
    ${footerBlock}
  </div>
  <div style="max-width:560px;margin:16px auto 0;text-align:center;font-family:${FONT_STACK};font-size:11px;color:${MUTED_INK};">
    Recoup, the AI agent platform for the music industry
  </div>
</div>`.trim();
}
