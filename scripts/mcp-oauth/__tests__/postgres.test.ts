import { describe, expect, it } from "vitest";
import { createPostgresTestAdapter } from "../fixtures/createPostgresTestAdapter";

describe.skipIf(!process.env.OAUTH_TEST_PG_SOCKET)("encrypted adapter with real PostgreSQL", () => {
  it("persists across adapter recreation, atomically consumes, and blocks revoked grants", async () => {
    const issuer = `test-${crypto.randomUUID()}`;
    const first = createPostgresTestAdapter(issuer)("AuthorizationCode");
    await first.upsert("code", { accountId: "synthetic-account", grantId: "grant" }, 60);
    const second = createPostgresTestAdapter(issuer)("AuthorizationCode");
    expect(await second.find("code")).toHaveProperty("accountId", "synthetic-account");
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, () => second.consume("code")),
    );
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    for (const attempt of attempts) {
      if (attempt.status === "rejected")
        expect(attempt.reason).toHaveProperty("error", "invalid_grant");
    }
    expect(await first.find("code")).toHaveProperty("consumed");
    await second.revokeByGrantId("grant");
    expect(await first.find("code")).toBeUndefined();
    await expect(first.upsert("late-code", { grantId: "grant" }, 60)).rejects.toThrow(
      "OAuth storage unavailable",
    );
  });
});
