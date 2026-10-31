export type ChatFenceErrorKind =
  | "conflict"
  | "deadlock"
  | "forbidden"
  | "not_enabled"
  | "not_found"
  | "invalid_command"
  | "unsupported_isolation"
  | "database_failure"
  | "transport_ambiguous"
  | "invalid_receipt";
export type ChatFenceFailure = {
  ok: false;
  error: { kind: ChatFenceErrorKind; retrySameCommand: boolean };
};

/** SQLSTATE 40001 also means tombstone/stale authority here; never retry it generically. */
export function classifyChatFenceError(code: string | undefined): ChatFenceFailure {
  if (!code) return { ok: false, error: { kind: "transport_ambiguous", retrySameCommand: false } };
  const kinds: Record<string, ChatFenceErrorKind> = {
    "40001": "conflict",
    "40P01": "deadlock",
    "42501": "forbidden",
    "55000": "not_enabled",
    P0002: "not_found",
    "22023": "invalid_command",
    "22P02": "invalid_command",
    P0001: "invalid_command",
    "0A000": "unsupported_isolation",
  };
  return {
    ok: false,
    error: {
      kind: code && Object.hasOwn(kinds, code) ? kinds[code] : "database_failure",
      retrySameCommand: code === "40P01",
    },
  };
}
