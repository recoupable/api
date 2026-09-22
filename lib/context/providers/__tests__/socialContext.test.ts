import { it, expect, vi } from "vitest";
import { collectContextSocials } from "../collectContextSocials";
const id = "11111111-1111-4111-8111-111111111111";
it("does not read profiles without access", async () => {
  const profiles = vi.fn();
  await expect(
    collectContextSocials(id, id, 1, { access: async () => false, profiles, posts: vi.fn() }),
  ).rejects.toThrow("accessible");
  expect(profiles).not.toHaveBeenCalled();
});
it("preserves pagination and distinguishes cached metrics from imagery", async () => {
  const r = await collectContextSocials(id, id, 1, {
    access: async () => true,
    profiles: async () => [],
    posts: async () => ({ posts: [], totalCount: 60 }),
  });
  expect(r.nextPostsPage).toBe(2);
  expect(r.gaps).toContain("No linked social profiles");
  expect(r.trace.freshness).toContain("unknown");
});
