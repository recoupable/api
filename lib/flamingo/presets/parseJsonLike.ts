/**
 * Parse JSON first, then a bounded JSON-like subset: single/double-quoted strings,
 * JSON escapes plus escaped apostrophes, and bare True/False/None values.
 * JSON.parse still validates structure and numbers. This is not a Python parser:
 * comments, tuples, string prefixes/concatenation and non-JSON escapes are rejected.
 * Quoted keys and text are never subject to literal replacement.
 */
export function parseJsonLike(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Normalize only the supported lexical differences, then validate as JSON.
  }

  let normalized = "";
  let i = 0;
  while (i < trimmed.length) {
    const char = trimmed[i];
    if (char === "'" || char === '"') {
      const delimiter = char;
      normalized += '"';
      i++;
      let closed = false;
      while (i < trimmed.length) {
        const content = trimmed[i++];
        if (content === delimiter) {
          normalized += '"';
          closed = true;
          break;
        }
        if (content === "\\") {
          const escaped = trimmed[i++];
          if (escaped === "'") normalized += "'";
          else if (escaped && '"\\/bfnrtu'.includes(escaped)) normalized += "\\" + escaped;
          else throw new SyntaxError("Unsupported JSON-like escape");
        } else {
          if (content.charCodeAt(0) < 0x20) throw new SyntaxError("Unescaped control character");
          normalized += content === '"' ? '\\"' : content;
        }
      }
      if (!closed) throw new SyntaxError("Unterminated JSON-like string");
    } else if (/[A-Za-z_]/.test(char)) {
      const start = i++;
      while (i < trimmed.length && /[A-Za-z0-9_]/.test(trimmed[i])) i++;
      const token = trimmed.slice(start, i);
      normalized +=
        token === "True" ? "true" : token === "False" ? "false" : token === "None" ? "null" : token;
    } else {
      normalized += char;
      i++;
    }
  }
  return JSON.parse(normalized);
}
