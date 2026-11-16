import { createHash } from "node:crypto";

interface Binding {
  workspace: string;
  application: string;
  environment: string;
  origin: string;
}
interface State {
  binding: Binding;
  revision: number;
  revoked: boolean;
  pending: { digest: string; issuedAt: number; expiresAt: number } | null;
  validUntil: number | null;
  issuedDigests?: string[];
}
interface Command {
  type: string;
  binding: Binding;
  expectedRevision: number;
  authorized: boolean;
  now: number;
  token?: string;
  observation?: {
    name: string;
    records: string[][];
    queriedAt: number;
    outcome: string;
  };
}

/** Offline executable specification only; no resolver, persistence or production caller. */
export function transition(state: State, command: Command): State {
  if (!command.authorized) throw new Error("authority");
  for (const key of ["workspace", "application", "environment", "origin"] as const)
    if (state.binding[key] !== command.binding[key]) throw new Error("binding");
  if (state.revision !== command.expectedRevision) throw new Error("revision");
  if (!Number.isSafeInteger(command.now) || command.now < 0) throw new Error("clock");
  if (state.revoked) throw new Error("revoked");
  const next = { ...state, revision: state.revision + 1 };
  if (command.type === "revoke") return { ...next, revoked: true, pending: null, validUntil: null };
  // State must already have passed registration syntax and future DNS eligibility policy.
  const digest = (token: string) => createHash("sha256").update(token).digest("hex");
  if (command.type === "issue") {
    if (!command.token || !/^[A-Za-z0-9_-]{43}$/.test(command.token)) throw new Error("token");
    const hash = digest(command.token);
    if (state.issuedDigests?.includes(hash)) throw new Error("reused token");
    return {
      ...next,
      issuedDigests: [...(state.issuedDigests ?? []), hash],
      pending: { digest: hash, issuedAt: command.now, expiresAt: command.now + 3600000 },
    };
  }
  if (command.type !== "verify") throw new Error("operation");
  const pending = state.pending;
  if (!pending || command.now >= pending.expiresAt)
    throw new Error("challenge expired or consumed");
  const observation = command.observation;
  if (
    !observation ||
    observation.outcome !== "answer" ||
    !Number.isSafeInteger(observation.queriedAt) ||
    observation.queriedAt < pending.issuedAt ||
    observation.queriedAt > command.now ||
    command.now - observation.queriedAt > 60000 ||
    observation.name !== `_recoup-app.${new URL(state.binding.origin).hostname}`
  )
    throw new Error("observation");
  const prefix = "recoup-app-v1=";
  const matches = observation.records.some(parts => {
    const record = parts.join("");
    const token = record.slice(prefix.length);
    return (
      record.startsWith(prefix) &&
      /^[A-Za-z0-9_-]{43}$/.test(token) &&
      digest(token) === pending.digest
    );
  });
  if (!matches) throw new Error("proof");
  return { ...next, pending: null, validUntil: command.now + 7 * 86400000 };
}
