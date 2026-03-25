import { DEFAULT_CONTENT_TEMPLATE } from "@/lib/content/contentTemplates";

/**
 * Parses the mention text into content generation parameters.
 *
 * Format: <artist_account_id> [template] [batch=N] [lipsync]
 *
 * @param text - The raw mention text to parse
 * @returns Parsed content generation parameters
 */
export function parseMentionArgs(text: string) {
  console.log("[content-agent] parseMentionArgs raw text:", JSON.stringify(text));
  const stripped = text.replace(/<@[A-Za-z0-9]+>/g, "").trim();
  const tokens = stripped.split(/\s+/);
  const artistAccountId = tokens[0];
  let template = DEFAULT_CONTENT_TEMPLATE;
  let batch = 1;
  let lipsync = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();
    if (token.startsWith("batch=")) {
      const n = parseInt(token.split("=")[1], 10);
      if (!isNaN(n) && n >= 1 && n <= 30) batch = n;
    } else if (token === "lipsync") {
      lipsync = true;
    } else if (!token.startsWith("batch") && token !== "lipsync") {
      template = tokens[i]; // preserve original case for template name
    }
  }

  return { artistAccountId, template, batch, lipsync };
}
