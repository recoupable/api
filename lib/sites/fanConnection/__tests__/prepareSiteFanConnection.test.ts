import { beforeEach, expect, it, vi } from "vitest";
import { prepareSiteFanConnection } from "../prepareSiteFanConnection";
const m = vi.hoisted(() => ({
  paid: vi.fn(),
  config: vi.fn(),
  save: vi.fn(),
  accounts: vi.fn(),
  oauth: vi.fn(),
}));
vi.mock("../hasPaidSiteSubscription", () => ({ hasPaidSiteSubscription: m.paid }));
vi.mock("../getFanOAuthConfig", () => ({ getFanOAuthConfig: m.oauth }));
vi.mock("@/lib/supabase/site_fan_connections/selectFanConfig", () => ({
  selectFanConfig: m.config,
}));
vi.mock("@/lib/supabase/site_fan_connections/updateFanConfig", () => ({ updateFanConfig: m.save }));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: m.accounts }));
const site = { id: "site", owner_id: "owner", artist_id: "artist", name: "Song title" };
beforeEach(() => {
  vi.resetAllMocks();
  m.paid.mockResolvedValue(true);
  m.config.mockResolvedValue(null);
  m.accounts.mockResolvedValue([{ name: "Artist name" }]);
});
it("enables connection with artist agreement and the actual published destination", async () => {
  expect(await prepareSiteFanConnection(site, "https://app.test/s/site")).toBe("enabled");
  expect(m.paid).toHaveBeenCalledWith("owner");
  expect(m.save).toHaveBeenCalledWith(
    expect.objectContaining({
      enabled: true,
      return_url: "https://app.test/s/site",
      marketing_text:
        "I agree to receive release announcements and offers by email from Artist name.",
    }),
    0,
  );
});
it("does not enable a paid feature for an unpaid workspace", async () => {
  m.paid.mockResolvedValue(false);
  expect(await prepareSiteFanConnection(site)).toBe("subscription-required");
  expect(m.save).not.toHaveBeenCalled();
});
it("blocks paid publishing with an actionable attribution error", async () => {
  await expect(prepareSiteFanConnection({ ...site, artist_id: null })).rejects.toThrow("artist");
  expect(m.save).not.toHaveBeenCalled();
});
it("does not rewrite an already enabled configuration", async () => {
  m.config.mockResolvedValue({ enabled: true, return_url: "https://app.test/s/site" });
  expect(await prepareSiteFanConnection(site, "https://app.test/s/site")).toBe("enabled");
  expect(m.save).not.toHaveBeenCalled();
});
