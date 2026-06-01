import { describe, it, expect } from "vitest";
import { buildSessionInsertRow } from "@/lib/sessions/buildSessionInsertRow";

const DEFAULT_CLONE = "https://github.com/recoupable/acc-1";

describe("buildSessionInsertRow", () => {
  it("returns sane defaults", () => {
    const row = buildSessionInsertRow({
      accountId: "acc-1",
      title: "Berlin",
      cloneUrl: DEFAULT_CLONE,
    });
    expect(row.account_id).toBe("acc-1");
    expect(row.title).toBe("Berlin");
    expect(row.status).toBe("running");
    expect(row.lifecycle_state).toBe("provisioning");
    expect(row.lifecycle_version).toBe(0);
    expect(row.sandbox_state).toEqual({ type: "vercel" });
    expect(row.branch).toBeNull();
    expect(row.clone_url).toBe(DEFAULT_CLONE);
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("writes the resolved cloneUrl onto clone_url", () => {
    const row = buildSessionInsertRow({
      accountId: "acc-1",
      title: "Berlin",
      cloneUrl: "https://github.com/recoupable/org-uuid-9",
    });
    expect(row.clone_url).toBe("https://github.com/recoupable/org-uuid-9");
  });

  it("always sets branch to null (no longer sourced from body)", () => {
    const row = buildSessionInsertRow({
      accountId: "acc-1",
      title: "Berlin",
      cloneUrl: DEFAULT_CLONE,
    });
    expect(row.branch).toBeNull();
  });

  it("hard-codes sandbox_state.type to vercel (only provider supported)", () => {
    const row = buildSessionInsertRow({
      accountId: "acc-1",
      title: "Berlin",
      cloneUrl: DEFAULT_CLONE,
    });
    expect(row.sandbox_state).toEqual({ type: "vercel" });
  });

  it("writes artist_id when artistId is provided", () => {
    const row = buildSessionInsertRow({
      accountId: "acc-1",
      title: "Berlin",
      cloneUrl: DEFAULT_CLONE,
      artistId: "artist-uuid-1",
    });
    expect(row.artist_id).toBe("artist-uuid-1");
  });

  it("sets artist_id to null when artistId is omitted", () => {
    const row = buildSessionInsertRow({
      accountId: "acc-1",
      title: "Berlin",
      cloneUrl: DEFAULT_CLONE,
    });
    expect(row.artist_id).toBeNull();
  });
});
