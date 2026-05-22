import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverSkills } from "@/lib/skills/discoverSkills";

function makeStat(isDir: boolean) {
  return { isDirectory: () => isDir, isFile: () => !isDir, size: 0, mtimeMs: 0 };
}

function makeDirent(name: string, isDir: boolean) {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isSymbolicLink: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  };
}

function frontmatter(name: string, description: string, extra = "") {
  return `---\nname: ${name}\ndescription: ${description}\n${extra}---\n\nBody for ${name}`;
}

function makeSandbox() {
  const files = new Map<string, string>();
  return {
    files,
    workingDirectory: "/sandbox/mono",
    stat: vi.fn(async (path: string) => {
      if (path.endsWith("/skills")) return makeStat(true);
      if (path.startsWith("/sandbox/mono/skills/") && !path.endsWith(".md")) return makeStat(true);
      throw new Error(`ENOENT: ${path}`);
    }),
    readdir: vi.fn(),
    access: vi.fn(async (path: string) => {
      if (!files.has(path)) throw new Error(`ENOENT: ${path}`);
    }),
    readFile: vi.fn(async (path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("discoverSkills", () => {
  it("discovers a single skill with name + description + path", async () => {
    const sb = makeSandbox();
    sb.readdir.mockResolvedValue([makeDirent("commit", true)]);
    sb.files.set("/sandbox/mono/skills/commit/SKILL.md", frontmatter("commit", "Make a commit"));
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills"]);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "commit",
      description: "Make a commit",
      path: "/sandbox/mono/skills/commit",
      filename: "SKILL.md",
    });
  });

  it("falls back to lowercase skill.md when SKILL.md is missing", async () => {
    const sb = makeSandbox();
    sb.readdir.mockResolvedValue([makeDirent("lowercase", true)]);
    sb.files.set("/sandbox/mono/skills/lowercase/skill.md", frontmatter("lowercase", "lc"));
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills"]);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.filename).toBe("skill.md");
  });

  it("returns [] when the directory does not exist", async () => {
    const sb = makeSandbox();
    sb.stat.mockRejectedValue(new Error("ENOENT"));
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills"]);
    expect(skills).toEqual([]);
  });

  it("skips entries that aren't directories", async () => {
    const sb = makeSandbox();
    sb.readdir.mockResolvedValue([makeDirent("README.md", false), makeDirent("good", true)]);
    sb.files.set("/sandbox/mono/skills/good/SKILL.md", frontmatter("good", "yes"));
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills"]);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe("good");
  });

  it("skips subdirs without SKILL.md / skill.md", async () => {
    const sb = makeSandbox();
    sb.readdir.mockResolvedValue([makeDirent("empty", true), makeDirent("real", true)]);
    sb.files.set("/sandbox/mono/skills/real/SKILL.md", frontmatter("real", "yes"));
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills"]);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe("real");
  });

  it("skips skills with invalid frontmatter (missing required fields)", async () => {
    const sb = makeSandbox();
    sb.readdir.mockResolvedValue([makeDirent("broken", true), makeDirent("ok", true)]);
    sb.files.set("/sandbox/mono/skills/broken/SKILL.md", "---\nname: broken\n---\nno desc");
    sb.files.set("/sandbox/mono/skills/ok/SKILL.md", frontmatter("ok", "yes"));
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills"]);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe("ok");
  });

  it("skips skills whose names shadow built-in commands (model / resume / new)", async () => {
    const sb = makeSandbox();
    sb.readdir.mockResolvedValue([
      makeDirent("model", true),
      makeDirent("resume", true),
      makeDirent("new", true),
      makeDirent("kept", true),
    ]);
    for (const name of ["model", "resume", "new", "kept"]) {
      sb.files.set(`/sandbox/mono/skills/${name}/SKILL.md`, frontmatter(name, "x"));
    }
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills"]);
    expect(skills.map(s => s.name)).toEqual(["kept"]);
  });

  it("dedupes by name across multiple directories (first wins, case-insensitive)", async () => {
    const sb = makeSandbox();
    sb.readdir.mockImplementation(async (dir: string) => {
      if (dir === "/sandbox/mono/skills") return [makeDirent("Foo", true)] as never;
      if (dir === "/global/.skills") return [makeDirent("foo", true)] as never;
      return [];
    });
    sb.files.set("/sandbox/mono/skills/Foo/SKILL.md", frontmatter("Foo", "project"));
    sb.files.set("/global/.skills/foo/SKILL.md", frontmatter("foo", "global"));
    sb.stat.mockImplementation(async (p: string) => {
      if (p === "/sandbox/mono/skills" || p === "/global/.skills") return makeStat(true);
      throw new Error("ENOENT");
    });
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills", "/global/.skills"]);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.description).toBe("project"); // first dir wins
  });

  it("populates options from frontmatter (camelCase + split lists)", async () => {
    const sb = makeSandbox();
    sb.readdir.mockResolvedValue([makeDirent("scoped", true)]);
    sb.files.set(
      "/sandbox/mono/skills/scoped/SKILL.md",
      frontmatter(
        "scoped",
        "limited",
        "allowed-tools: bash, read\ndisable-model-invocation: true\n",
      ),
    );
    const skills = await discoverSkills(sb as never, ["/sandbox/mono/skills"]);
    expect(skills[0]?.options).toEqual({
      disableModelInvocation: true,
      allowedTools: ["bash", "read"],
    });
  });
});
