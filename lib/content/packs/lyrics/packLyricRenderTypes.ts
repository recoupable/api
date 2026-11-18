import type { PackFile } from "../packTypes";
export const PACK_LYRIC_FONT_SHA256 =
  "b1c63567cec7ce2e6b62734fb6744449d801376d4646b8459d569e1b35bf444b";
export const PACK_LYRIC_SOURCE_FONT_SHA256 =
  "9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543";
export type PackMediaRuntime = {
  writeFiles: (files: { path: string; content: Buffer }[]) => Promise<unknown>;
  runCommand: (
    command: string,
    args: string[],
  ) => Promise<{ exitCode: number; stdout: () => Promise<string> }>;
  readFileToBuffer: (input: { path: string }) => Promise<Buffer | null>;
};
/** Trusted LOCAL injection only. Implementations must kill owned commands on abort and bound stdout. */
export type PackLyricRuntime = PackMediaRuntime & {
  fileSize: (path: string) => Promise<number>;
  removeFiles: (paths: string[]) => Promise<void>;
  /** Resolve only after owned processes and pipes close; reject with owned identity if termination is unknown. */
  abort: () => Promise<void>;
  cleanup: () => Promise<void>;
};
export type PackLyricMediaCapability = {
  fontBytes: Buffer;
  /** SHA256 of exact `ffmpeg -version` stdout, including configuration/build. */
  rendererBuildSha256: string;
  withRuntime: <T>(
    run: (runtime: PackLyricRuntime, ffmpeg: string, ffprobe: string) => Promise<T>,
  ) => Promise<T>;
  fetchMedia: (url: string) => Promise<{ bytes: Buffer; contentType: string }>;
  storeFile: (owner: string, bytes: Buffer, contentType: string) => Promise<PackFile>;
};

export type PackLyricAudioEvidence = {
  audioIndex: number;
  codec: string;
  sampleRate: number;
  channels: number;
  timeBase: string;
  startTime: number;
  durationTicks: number;
  durationMsNumerator: string;
  durationMsDenominator: string;
};
