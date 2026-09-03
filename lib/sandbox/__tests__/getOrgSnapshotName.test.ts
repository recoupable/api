import { describe, expect, it } from "vitest";
import { getOrgSnapshotName } from "@/lib/sandbox/getOrgSnapshotName";
import { DEFAULT_SANDBOX_BASE_SNAPSHOT_ID } from "@/lib/sandbox/defaultBaseSnapshotId";

describe("getOrgSnapshotName", () => {
  it("suffixes the org repo name with the tail of the base snapshot id, lowercased", () => {
    expect(getOrgSnapshotName("acme-records", "snap_tbpR2eFlVENexiRoMEcK5yl6WEbs")).toBe(
      "acme-records-5yl6webs",
    );
  });

  it("changes when the base changes, so an org snapshot built on an old base is a miss", () => {
    expect(getOrgSnapshotName("acme-records", "snap_RgVtpDO4y1BJHQiUbptMwS3Rt2EQ")).not.toBe(
      getOrgSnapshotName("acme-records", "snap_tbpR2eFlVENexiRoMEcK5yl6WEbs"),
    );
  });

  it("defaults to the current base", () => {
    expect(getOrgSnapshotName("acme-records")).toBe(
      getOrgSnapshotName("acme-records", DEFAULT_SANDBOX_BASE_SNAPSHOT_ID),
    );
  });
});
