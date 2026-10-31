/** Checks outbound link syntax only, not domain reputation or server-fetch safety. */
export function isResearchHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return (
      parsed.protocol === "https:" && !!parsed.hostname && !parsed.username && !parsed.password
    );
  } catch {
    return false;
  }
}
