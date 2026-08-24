import { describe, it, expect } from "vitest";
import { buildMusicNotification } from "../buildMusicNotification";

const base = {
  generationId: "11111111-2222-4333-8444-555555555555",
  accountEmail: "artist@label.com",
  prompt: "Genre: lo-fi soul. BPM: 82.",
  lyrics: "[verse]\nMorning light",
  durationSeconds: 25.87,
  status: "completed" as const,
};

describe("buildMusicNotification", () => {
  it("links to the song page so the message is actionable", () => {
    const text = buildMusicNotification(base);

    expect(text).toContain("https://chat.recoupable.dev/music/11111111-2222-4333-8444-555555555555");
  });

  it("names the account that generated it", () => {
    expect(buildMusicNotification(base)).toContain("artist@label.com");
  });

  it("carries the prompt and the lyrics", () => {
    const text = buildMusicNotification(base);

    expect(text).toContain("Genre: lo-fi soul. BPM: 82.");
    expect(text).toContain("Morning light");
  });

  it("truncates long lyrics rather than flooding the chat", () => {
    const text = buildMusicNotification({ ...base, lyrics: "la ".repeat(500) });

    expect(text.length).toBeLessThan(1200);
    expect(text).toContain("…");
  });

  it("reports the real output length, not the request", () => {
    expect(buildMusicNotification(base)).toContain("25.9s");
  });

  it("marks a failure differently, since that is the event worth reacting to", () => {
    const text = buildMusicNotification({
      ...base,
      status: "failed",
      durationSeconds: null,
      errorMessage: "Lyrics structure tags were rejected.",
    });

    expect(text).toContain("failed");
    expect(text).toContain("Lyrics structure tags were rejected.");
  });

  it("copes with an account that has no email on file", () => {
    const text = buildMusicNotification({ ...base, accountEmail: null });

    expect(text).toContain("unknown account");
  });
});
