import { writeFile, stat } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { matchYoutubeRecording } from "../matchYoutubeRecording";
import { searchYoutubeRecording } from "../searchYoutubeRecording";

import { acquireContextYoutubeAudio } from "../acquireContextYoutubeAudio";
import { downloadYoutubeAudio } from "../downloadYoutubeAudio";
import { vi } from "vitest";
const recording = { title: "Hate U", artists: ["chillpill"], durationSeconds: 152.148 };
const candidate = {
  id: "abcdefghijk",
  title: "chillpill - Hate U (Official Audio)",
  channel: "chillpill",
  duration: 152,
};
describe("YouTube recording acquisition", () => {
  it("rejects alternate versions and mismatched lengths", () => {
    expect(
      matchYoutubeRecording(recording, [{ ...candidate, title: candidate.title + " live" }])
        .selected,
    ).toBeNull();
    expect(matchYoutubeRecording(recording, [{ ...candidate, duration: 200 }]).selected).toBeNull();
  });
  it("requires review for multiple plausible recordings", () => {
    expect(
      matchYoutubeRecording(recording, [candidate, { ...candidate, id: "12345678901" }]).status,
    ).toBe("needs_review");
  });
  it("selects a sole metadata match without claiming audio identity verification", () => {
    const result = matchYoutubeRecording(recording, [candidate]);
    expect(result.selected?.id).toBe(candidate.id);
    expect(result.verification).toBe("metadata_only");
  });
  it("searches without downloading and records the query", async () => {
    let args: string[] = [];
    const result = await searchYoutubeRecording(recording, async (_cmd, supplied) => {
      args = supplied;
      return JSON.stringify({ entries: [candidate] });
    });
    expect(args).toContain("--skip-download");
    expect(result.candidates).toHaveLength(1);
    expect(result.query).toContain("chillpill");
  });
});
it("preserves search failures as a trace without downloading or saving", async () => {
  const download = vi.fn();
  const save = vi.fn();
  const result = await acquireContextYoutubeAudio(recording, {
    search: vi.fn().mockRejectedValue(new Error("Provider unavailable")),
    download,
    save,
  });
  expect(result.status).toBe("failed");
  expect(result.steps[0].name).toBe("Search YouTube");
  expect(download).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
it("does not download or save ambiguous search results", async () => {
  const download = vi.fn();
  const save = vi.fn();
  const result = await acquireContextYoutubeAudio(recording, {
    search: vi
      .fn()
      .mockResolvedValue({ candidates: [candidate, { ...candidate, id: "12345678901" }] }),
    download,
    save,
  });
  expect(result.status).toBe("needs_review");
  expect(download).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
it("rejects arbitrary URLs before executing the downloader", async () => {
  const run = vi.fn();
  await expect(downloadYoutubeAudio("http://localhost/private", 152, run)).rejects.toThrow();
  expect(run).not.toHaveBeenCalled();
});

it("checks decoded audio, returns a hash, and removes temporary files", async () => {
  let file = "";
  const calls: string[] = [];
  const result = await downloadYoutubeAudio(candidate.id, 152, async (command, args) => {
    calls.push(command);
    if (command === "yt-dlp") {
      file = args[args.indexOf("-o") + 1];
      await writeFile(file, Buffer.from("test audio"));
      return "";
    }
    if (command === "ffprobe")
      return JSON.stringify({ format: { duration: "152" }, streams: [{ codec_type: "audio" }] });
    return "";
  });
  expect(calls).toEqual(["yt-dlp", "ffprobe", "ffmpeg"]);
  expect(result.trace.sha256).toHaveLength(64);
  await expect(stat(file)).rejects.toThrow();
});
it("removes a downloaded file when its duration is wrong", async () => {
  let file = "";
  await expect(
    downloadYoutubeAudio(candidate.id, 152, async (command, args) => {
      if (command === "yt-dlp") {
        file = args[args.indexOf("-o") + 1];
        await writeFile(file, Buffer.from("test audio"));
        return "";
      }
      return JSON.stringify({ format: { duration: "500" }, streams: [{ codec_type: "audio" }] });
    }),
  ).rejects.toThrow("does not match");
  await expect(stat(file)).rejects.toThrow();
});
