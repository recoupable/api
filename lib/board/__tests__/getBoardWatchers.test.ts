import { describe, it, expect, afterEach, vi } from "vitest";

import { getBoardWatchers } from "@/lib/board/getBoardWatchers";

vi.mock("@/lib/board/claudeWatcher", () => ({
  claudeWatcher: { tail: "--label agent=claude", run: vi.fn() },
}));

describe("getBoardWatchers", () => {
  const original = process.env.VERCEL_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = original;
  });

  it("registers the claude watcher in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(Object.keys(getBoardWatchers())).toEqual(["claude"]);
  });

  it.each(["preview", "development", undefined])("registers nothing in %s", env => {
    if (env === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = env;
    expect(getBoardWatchers()).toEqual({});
  });
});
