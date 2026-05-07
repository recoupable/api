import { TIMEOUT_BUFFER_MS } from "./constants";
import type { VercelSandboxSession } from "./types";

export function getRemainingTimeoutFromSession(session: VercelSandboxSession): number | undefined {
  const timeout = session.timeout;
  if (typeof timeout !== "number" || timeout <= 0) {
    return undefined;
  }

  const startedAt = session.startedAt?.getTime() ?? session.requestedAt?.getTime();
  if (typeof startedAt !== "number") {
    return undefined;
  }

  const proactiveTimeout = Math.max(timeout - TIMEOUT_BUFFER_MS, 0);
  const remaining = startedAt + proactiveTimeout - Date.now();
  return remaining > 10_000 ? remaining : undefined;
}
