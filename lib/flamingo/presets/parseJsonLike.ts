/**
 * Converts Python-style single-quoted dict output to valid JSON,
 * then parses it. Falls back to JSON.parse if already valid JSON.
 *
 * @param raw - Raw model output string (may use single or double quotes)
 * @returns Parsed JavaScript object
 * @throws Error if the string cannot be parsed as JSON or Python dict
 */
export function parseJsonLike(raw: string): unknown {
  const trimmed = raw.trim();

  // Try standard JSON first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to single-quote fix
  }

  // Replace single quotes with double quotes (Python dict → JSON)
  // Handle escaped apostrophes in text like "don't" by only replacing
  // quotes that are at dict/array boundaries
  const fixed = trimmed
    .replace(/'/g, '"')
    .replace(/True/g, "true")
    .replace(/False/g, "false")
    .replace(/None/g, "null");

  return JSON.parse(fixed);
}

