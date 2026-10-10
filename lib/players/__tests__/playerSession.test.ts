import { afterEach, expect, it, vi } from "vitest";
import { signPlayerSession } from "../signPlayerSession";
import { verifyPlayerSession } from "../verifyPlayerSession";
afterEach(() => vi.unstubAllEnvs());
it("binds the session to a player revision and the trusted player origin", () => {
  vi.stubEnv("PLAYER_SESSION_SECRET", "test-key");
  const payload = {
    playerId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    revision: 2,
    origin: "https://app.recoupable.dev",
    expiresAt: Date.now() + 60000,
  };
  const signed = signPlayerSession(payload);
  expect(verifyPlayerSession(signed)).toEqual(payload);
  expect(() => verifyPlayerSession(signed + "x")).toThrow();
});
it("rejects expired and excessively long sessions", () => {
  vi.stubEnv("PLAYER_SESSION_SECRET", "test-key");
  const payload = {
    playerId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    revision: 1,
    origin: "https://app.recoupable.dev",
    expiresAt: Date.now() - 1,
  };
  expect(() => verifyPlayerSession(signPlayerSession(payload))).toThrow();
  expect(() =>
    verifyPlayerSession(signPlayerSession({ ...payload, expiresAt: Date.now() + 7200001 })),
  ).toThrow();
});
