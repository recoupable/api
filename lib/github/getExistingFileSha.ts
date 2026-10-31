/** Legacy update lookup; guarded updates must never call this helper. */
export async function getExistingFileSha(
  url: string,
  token: string,
): Promise<{ sha?: string } | { error: string }> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (response.ok) return { sha: (await response.json()).sha };
    if (response.status === 404) return {};
    console.error("[GitHub] File lookup failed:", response.status, await response.text());
  } catch (error) {
    console.error("[GitHub] File lookup failed:", error);
  }
  return { error: "Failed to check existing file" };
}
