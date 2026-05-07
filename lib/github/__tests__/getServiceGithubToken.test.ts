import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";

const ORIGINAL = process.env.GITHUB_TOKEN;

beforeEach(() => {
  delete process.env.GITHUB_TOKEN;
});

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.GITHUB_TOKEN;
  } else {
    process.env.GITHUB_TOKEN = ORIGINAL;
  }
});

describe("getServiceGithubToken", () => {
  it("returns undefined when GITHUB_TOKEN is unset", () => {
    expect(getServiceGithubToken()).toBeUndefined();
  });

  it("returns undefined when GITHUB_TOKEN is the empty string", () => {
    process.env.GITHUB_TOKEN = "";
    expect(getServiceGithubToken()).toBeUndefined();
  });

  it("returns the token when set", () => {
    process.env.GITHUB_TOKEN = "ghs_secret";
    expect(getServiceGithubToken()).toBe("ghs_secret");
  });
});
