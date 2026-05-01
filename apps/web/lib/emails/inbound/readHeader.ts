/**
 * Case-insensitive lookup of a key on an email headers object.
 * RFC 5322 header names are case-insensitive; different senders and
 * forwarders normalize them differently ("From" vs "from" vs "FROM").
 */
export function readHeader(headers: Record<string, string>, name: string): string | undefined {
  const lowerName = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowerName) return headers[key];
  }
  return undefined;
}
