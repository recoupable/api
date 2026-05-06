import { describe, it, expect } from "vitest";
import { buildSessionInsertRow } from "@/lib/sessions/buildSessionInsertRow";

describe("buildSessionInsertRow", () => {
  it("returns sane defaults for an empty body", () => {
    const row = buildSessionInsertRow({ body: {}, accountId: "acc-1", title: "Berlin" });
    expect(row.account_id).toBe("acc-1");
    expect(row.title).toBe("Berlin");
    expect(row.status).toBe("running");
    expect(row.lifecycle_state).toBe("provisioning");
    expect(row.lifecycle_version).toBe(0);
    expect(row.sandbox_state).toEqual({ type: "vercel" });
    expect(row.branch).toBeNull();
    expect(row.clone_url).toBeNull();
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("forwards branch + clone fields verbatim", () => {
    const row = buildSessionInsertRow({
      body: {
        branch: "main",
        cloneUrl: "https://github.com/recoupable/ai.git",
      },
      accountId: "acc-1",
      title: "Berlin",
    });
    expect(row.branch).toBe("main");
    expect(row.clone_url).toBe("https://github.com/recoupable/ai.git");
  });

  it("uses the provided sandboxType when set", () => {
    const row = buildSessionInsertRow({
      body: { sandboxType: "vercel" },
      accountId: "acc-1",
      title: "Berlin",
    });
    expect(row.sandbox_state).toEqual({ type: "vercel" });
  });
});
