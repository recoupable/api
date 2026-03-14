import { describe, it, expect } from "vitest";
import { parseGitModules } from "../parseGitModules";

describe("parseGitModules", () => {
  it("parses a single submodule entry", () => {
    const content = `[submodule ".openclaw/workspace/orgs/my-org"]
\tpath = .openclaw/workspace/orgs/my-org
\turl = https://github.com/recoupable/org-my-org-abc123`;

    const result = parseGitModules(content);

    expect(result).toEqual([
      {
        path: ".openclaw/workspace/orgs/my-org",
        url: "https://github.com/recoupable/org-my-org-abc123",
      },
    ]);
  });

  it("parses multiple submodule entries", () => {
    const content = `[submodule ".openclaw/workspace/orgs/org-a"]
\tpath = .openclaw/workspace/orgs/org-a
\turl = https://github.com/recoupable/org-a-111
[submodule ".openclaw/workspace/orgs/org-b"]
\tpath = .openclaw/workspace/orgs/org-b
\turl = https://github.com/recoupable/org-b-222`;

    const result = parseGitModules(content);

    expect(result).toEqual([
      {
        path: ".openclaw/workspace/orgs/org-a",
        url: "https://github.com/recoupable/org-a-111",
      },
      {
        path: ".openclaw/workspace/orgs/org-b",
        url: "https://github.com/recoupable/org-b-222",
      },
    ]);
  });

  it("returns empty array for empty content", () => {
    expect(parseGitModules("")).toEqual([]);
  });

  it("handles entries with spaces around equals sign", () => {
    const content = `[submodule "my-sub"]
  path = my-sub
  url = https://github.com/owner/repo`;

    const result = parseGitModules(content);

    expect(result).toEqual([{ path: "my-sub", url: "https://github.com/owner/repo" }]);
  });

  it("skips incomplete entries (missing url)", () => {
    const content = `[submodule "incomplete"]
\tpath = some/path
[submodule "complete"]
\tpath = other/path
\turl = https://github.com/owner/repo`;

    const result = parseGitModules(content);

    expect(result).toEqual([{ path: "other/path", url: "https://github.com/owner/repo" }]);
  });

  it("skips incomplete entries (missing path)", () => {
    const content = `[submodule "no-path"]
\turl = https://github.com/owner/repo
[submodule "complete"]
\tpath = valid/path
\turl = https://github.com/owner/repo2`;

    const result = parseGitModules(content);

    expect(result).toEqual([{ path: "valid/path", url: "https://github.com/owner/repo2" }]);
  });
});
