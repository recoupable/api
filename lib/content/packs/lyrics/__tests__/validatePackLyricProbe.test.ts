import { it, expect } from "vitest";
import { validatePackLyricProbe } from "../validatePackLyricProbe";
const source = () => ({
  streams: [
    {
      index: 0,
      codec_type: "audio",
      codec_name: "alac",
      sample_rate: "8000",
      channels: 1,
      start_time: "0.000000",
      time_base: "1/8000",
      duration_ts: 16000,
      duration: "2.000000",
    },
  ],
  format: { duration: "99.0" },
});
it("uses selected audio rational duration rather than container length", () => {
  expect(
    validatePackLyricProbe(source(), { kind: "source", durationMs: 2000, endMs: 1999 }).audioIndex,
  ).toBe(0);
  expect(() =>
    validatePackLyricProbe(source(), { kind: "source", durationMs: 99000, endMs: 3000 }),
  ).toThrow();
});
it.each([null, "", NaN, Infinity, "NaN", -1])(
  "rejects invalid selected audio metadata %s",
  value => {
    const probe = source();
    probe.streams[0].duration_ts = value as number;
    expect(() =>
      validatePackLyricProbe(probe, { kind: "source", durationMs: 2000, endMs: 1000 }),
    ).toThrow();
  },
);
it("rejects fractional source-overrun even if rounded duration matches", () => {
  const probe = source();
  probe.streams[0].duration_ts = 15999;
  expect(() =>
    validatePackLyricProbe(probe, { kind: "source", durationMs: 2000, endMs: 2000 }),
  ).toThrow();
});
it.each([undefined, "NaN", Infinity])(
  "refuses malformed final duration %s before store",
  duration => {
    const probe = {
      ...source(),
      format: { duration },
      streams: [
        ...source().streams,
        {
          index: 1,
          codec_type: "video",
          width: 1080,
          height: 1920,
          start_time: "0",
          time_base: "1/15360",
          duration_ts: 30720,
          duration: "2",
          avg_frame_rate: "30/1",
          nb_read_frames: "60",
        },
      ],
    };
    expect(() =>
      validatePackLyricProbe(probe, {
        kind: "output",
        frames: 60,
        durationMs: 2000,
        sourceAudio: validatePackLyricProbe(source(), {
          kind: "source",
          durationMs: 2000,
          endMs: 1000,
        }),
      }),
    ).toThrow();
  },
);
it("rejects inconsistent video duration even when container/audio/count fields appear valid", () => {
  const probe = {
    ...source(),
    format: { duration: "2" },
    streams: [
      ...source().streams,
      {
        index: 1,
        codec_type: "video",
        width: 1080,
        height: 1920,
        start_time: "0",
        time_base: "1/15360",
        duration_ts: 61440,
        duration: "4",
        avg_frame_rate: "30/1",
        nb_read_frames: "60",
      },
    ],
  };
  expect(() =>
    validatePackLyricProbe(probe, {
      kind: "output",
      frames: 60,
      durationMs: 2000,
      sourceAudio: validatePackLyricProbe(source(), {
        kind: "source",
        durationMs: 2000,
        endMs: 1000,
      }),
    }),
  ).toThrow();
});

it("retains exact selected audio evidence", () => {
  expect(
    validatePackLyricProbe(source(), { kind: "source", durationMs: 2000, endMs: 1000 }),
  ).toMatchObject({
    audioIndex: 0,
    sampleRate: 8000,
    channels: 1,
    codec: "alac",
    timeBase: "1/8000",
    startTime: 0,
    durationTicks: 16000,
    durationMsNumerator: "16000000",
    durationMsDenominator: "8000",
  });
});

it.each(["sample_rate", "channels", "codec_name"])("rejects changed final audio %s", field => {
  const audio = { ...source().streams[0], codec_name: "aac" };
  const probe = {
    format: { duration: "2" },
    streams: [
      audio,
      {
        index: 1,
        codec_type: "video",
        width: 1080,
        height: 1920,
        start_time: "0",
        time_base: "1/15360",
        duration_ts: 30720,
        avg_frame_rate: "30/1",
        nb_read_frames: "60",
      },
    ],
  };
  const mode = {
    kind: "output" as const,
    frames: 60,
    durationMs: 2000,
    sourceAudio: validatePackLyricProbe(source(), {
      kind: "source",
      durationMs: 2000,
      endMs: 1000,
    }),
  };
  expect(() => validatePackLyricProbe(probe, mode)).not.toThrow();
  Object.assign(audio, {
    [field]: field === "sample_rate" ? "16000" : field === "channels" ? 2 : "mp3",
  });
  expect(() => validatePackLyricProbe(probe, mode)).toThrow(/format/);
});
