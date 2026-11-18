import { beforeEach, expect, it, vi, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureSql } from "./fixtureSql";
import pins from "./sources.json";
vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
let root: string;
beforeEach(() => {
  vi.resetAllMocks();
  root = realpathSync(mkdtempSync(join(tmpdir(), "catalog-transport-")));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});
it.each(["localhost", "127.0.0.1", "relative/socket"])(
  "refuses %s before any subprocess",
  socket => {
    vi.stubEnv("SITES_BRIDGE_SOCKET", socket);
    expect(() => fixtureSql("TRUNCATE accounts;")).toThrow(
      "Owned canonical fixture socket required",
    );
    expect(spawnSync).not.toHaveBeenCalled();
  },
);
it("rejects an unregistered owned directory before any subprocess", () => {
  vi.stubEnv("SITES_BRIDGE_SOCKET", root);
  expect(() => fixtureSql("TRUNCATE accounts;")).toThrow();
  expect(spawnSync).not.toHaveBeenCalled();
});
it("requires the exact fixture marker and uses its socket as HOME", () => {
  vi.stubEnv("SITES_BRIDGE_SOCKET", root);
  vi.stubEnv("CATALOG_PSQL", "/fixture/psql");
  const marker = {
    fixture: "catalog-storage-size",
    socket: root,
    databaseTree: pins.database_tree,
    uid: process.getuid!(),
  };
  writeFileSync(
    join(root, "catalog-size.json"),
    JSON.stringify({ ...marker, databaseTree: "wrong" }),
  );
  expect(() => fixtureSql("SELECT 1")).toThrow("Catalog fixture marker mismatch");
  expect(spawnSync).not.toHaveBeenCalled();
  writeFileSync(join(root, "catalog-size.json"), JSON.stringify(marker));
  vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: "1", stderr: "" } as never);
  expect(fixtureSql("SELECT 1")).toBe("1");
  expect(spawnSync).toHaveBeenCalledWith(
    "/fixture/psql",
    expect.arrayContaining(["-h", root]),
    expect.objectContaining({ env: expect.objectContaining({ HOME: root }) }),
  );
});
