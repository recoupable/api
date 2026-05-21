import { describe, it, expect } from "vitest";
import { toDisplayPath } from "@/lib/agent/tools/toDisplayPath";

const WORKDIR = "/sandbox/mono";

describe("toDisplayPath", () => {
  it("strips the workingDirectory prefix when the file is inside", () => {
    expect(toDisplayPath("/sandbox/mono/src/index.ts", WORKDIR)).toBe("src/index.ts");
  });

  it("returns `.` for the workingDirectory itself", () => {
    expect(toDisplayPath("/sandbox/mono", WORKDIR)).toBe(".");
  });

  it("keeps an absolute path when it's outside the working directory", () => {
    expect(toDisplayPath("/etc/hosts", WORKDIR)).toBe("/etc/hosts");
  });

  it("resolves a relative input against the working directory", () => {
    expect(toDisplayPath("apps/web/page.tsx", WORKDIR)).toBe("apps/web/page.tsx");
  });

  it("normalizes back-slashes to forward slashes (Windows-style absolute input)", () => {
    // path.resolve on POSIX leaves backslashes inside the segment; the
    // helper should still emit forward slashes for paths it keeps absolute.
    const result = toDisplayPath("/tmp/win\\path", WORKDIR);
    expect(result.includes("\\")).toBe(false);
  });
});
