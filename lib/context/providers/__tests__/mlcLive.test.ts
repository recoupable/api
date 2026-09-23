import { expect, it } from "vitest";
import { getRecoupMlcAccessToken } from "../getRecoupMlcAccessToken";
import { lookupMlcRecording } from "../lookupMlcRecording";
import { lookupMlcWork } from "../lookupMlcWork";

/** Explicit local diagnostic: one public recording and its linked candidate work. */
it.skipIf(process.env.MLC_LIVE_VERIFY !== "1")(
  "resolves the reviewed ISRC through Recoup MLC credentials",
  async () => {
    process.loadEnvFile(".env.local");
    const token = await getRecoupMlcAccessToken();
    const recording = await lookupMlcRecording("USAT22103065", token);
    const workCode = recording.candidates[0]?.mlcsongCode;
    expect(recording.trace.httpStatus).toBe(200);
    expect(workCode).toBeTruthy();
    const work = await lookupMlcWork(workCode!, token);
    expect(work.trace.httpStatus).toBe(200);
    expect(work.work?.mlcSongCode).toBe(workCode);
    console.info(
      "MLC verification",
      JSON.stringify({
        recordingCandidates: recording.candidates.length,
        workCode,
        iswc: work.work?.iswc,
        writerCount: work.work?.writers?.length,
        publisherCount: work.work?.publishers?.length,
      }),
    );
  },
  60_000,
);
