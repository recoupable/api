const ATTIO_BASE_URL = "https://api.attio.com/v2";

/**
 * Low-level Attio REST call — prepends the base URL and bearer auth so each
 * operation module (assertPersonByEmail, createNote, …) stays a thin wrapper.
 * Reads ATTIO_API_KEY at call time (server-only); returns the raw Response.
 */
export function attioFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${ATTIO_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}
