import { z } from "zod";
import { lookupMlcRecording } from "../providers/lookupMlcRecording";
import { lookupMlcWork } from "../providers/lookupMlcWork";
import { searchMlcWorks, mlcWorkSearchSchema } from "../providers/searchMlcWorks";
import { runContextEnrichment } from "./runContextEnrichment";
const base = { subjectId: z.uuid(), collectionVersion: z.string().min(1).max(100) };
const schema = z.discriminatedUnion("operation", [
  z.strictObject({
    ...base,
    operation: z.literal("recording"),
    isrc: z
      .string()
      .transform(s => s.replace(/-/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)),
  }),
  z.strictObject({
    ...base,
    operation: z.literal("work"),
    workCode: z.string().regex(/^[A-Za-z0-9-]{1,100}$/),
  }),
  mlcWorkSearchSchema.extend({ ...base, operation: z.literal("search") }),
]);
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  resolveRecording?: (owner: string, requestId: string, subjectId: string) => Promise<string>;
  getAccessToken: () => Promise<string>;
  fetcher?: typeof fetch;
};
/** Server-side MLC collector. Caller confirms subject/work association before detail lookup. */
export async function collectContextMlc(
  actor: string,
  owner: string,
  requestId: string,
  input: z.input<typeof schema>,
  deps: Dependencies,
) {
  const args = schema.parse(input);
  const authorizeInput = async () => {
    await deps.authorize(actor, owner);
    if (args.operation === "recording") {
      const resolve =
        deps.resolveRecording ??
        (await import("@/lib/supabase/context_requests/getContextRecordingIsrc"))
          .getContextRecordingIsrc;
      if ((await resolve(owner, requestId, args.subjectId)) !== args.isrc)
        throw new Error("ISRC does not match the context recording");
    }
  };
  const url =
    args.operation === "recording"
      ? "https://public-api.themlc.com/search/recordings"
      : args.operation === "search"
        ? "https://public-api.themlc.com/search/songcode"
        : `https://public-api.themlc.com/work/id/${encodeURIComponent(args.workCode)}`;
  const topic =
    args.operation === "recording"
      ? "mlc_recordings"
      : args.operation === "search"
        ? "mlc_work_candidates"
        : "mlc_works";
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: `mlc-${args.operation}-v1`,
      topic,
      subjectId: args.subjectId,
      provider: "mlc",
      model: "none",
      evidenceKind: "observation",
      input: args,
      sources: [{ url, kind: "provider_metadata", content: { ...args, role: "lookup_request" } }],
    },
    {
      ...deps,
      authorize: authorizeInput,
      call: async () => {
        const token = await deps.getAccessToken();
        const result =
          args.operation === "recording"
            ? await lookupMlcRecording(args.isrc, token, deps.fetcher)
            : args.operation === "work"
              ? await lookupMlcWork(args.workCode, token, deps.fetcher)
              : await searchMlcWorks(
                  { title: args.title, ...(args.writers ? { writers: args.writers } : {}) },
                  token,
                  deps.fetcher,
                );
        return {
          content: { ...result, identityConfirmed: false, ownershipVerified: false },
          coverage: result.status === "not_found" ? "unknown" : "partial",
          trace: result.trace,
          costUsd: null,
          costStatus: "unknown",
          observedSources: [
            {
              url,
              kind: "provider_metadata",
              content: {
                httpStatus: result.trace.httpStatus,
                observedAt: result.trace.startedAt,
                payload: "rawResponse" in result.trace ? result.trace.rawResponse : null,
              },
            },
          ],
        };
      },
    },
  );
}
