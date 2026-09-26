import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { collectContextMlc } from "../collectContextMlc";
import { getRecoupMlcAccessToken } from "../../providers/getRecoupMlcAccessToken";

// Opt-in diagnostic. All writes go to an explicitly selected disposable local PostgreSQL port.
it.skipIf(process.env.MLC_MODULE_LIVE_VERIFY !== "1")(
  "collects, saves, and reuses live MLC recording evidence",
  async () => {
    process.loadEnvFile(".env.local");
    const port = process.env.CONTEXT_LOCAL_PG_PORT;
    if (!port || !/^\d{4,5}$/.test(port))
      throw new Error("Disposable local PostgreSQL port required");
    const sql = (statement: string) =>
      execFileSync(
        "/opt/homebrew/opt/postgresql@17/bin/psql",
        ["-h", "127.0.0.1", "-p", port, "-d", "postgres", "-XAt", "-v", "ON_ERROR_STOP=1"],
        { input: statement, encoding: "utf8" },
      ).trim();
    const quote = (value: unknown) =>
      "'" + (typeof value === "string" ? value : JSON.stringify(value)).replaceAll("'", "''") + "'";
    const owner = randomUUID();
    const resource = randomUUID();
    const recording = randomUUID();
    const request = randomUUID();
    const isrc = "USAT22103065";
    sql(`begin;
      insert into accounts(id) values(${quote(owner)});
      insert into songs(isrc) values(${quote(isrc)});
      insert into context_resources(id,provider,resource_kind,provider_id,canonical_url)
        values(${quote(resource)},'spotify','track','2zpWJxfuyxqCYhpsAqH7Uh','https://open.spotify.com/track/2zpWJxfuyxqCYhpsAqH7Uh');
      insert into context_subjects(id,kind,song_isrc) values(${quote(recording)},'recording',${quote(isrc)});
      insert into context_requests(id,owner_id,created_by,resource_id,idempotency_key,input_fingerprint,input,status,output)
        values(${quote(request)},${quote(owner)},${quote(owner)},${quote(resource)},${quote(request)},repeat('f',64),
          ${quote({ url: "https://open.spotify.com/track/2zpWJxfuyxqCYhpsAqH7Uh" })},'completed',
          ${quote({ subjectIds: [recording] })});
      commit;`);
    const rpc = async (name: string, params: Record<string, unknown>) => {
      if (
        ![
          "claim_context_enrichment",
          "complete_context_enrichment",
          "fail_context_enrichment",
        ].includes(name)
      )
        throw new Error("Unexpected local database operation");
      return JSON.parse(
        sql(
          `select public.${name}(${Object.entries(params)
            .map(([key, value]) => `${key}=>${quote(value)}`)
            .join(",")});`,
        ),
      );
    };
    const authorize = async (actor: string, selectedOwner: string) => {
      if (actor !== owner || selectedOwner !== owner) throw new Error("Wrong test owner");
    };
    const resolveRecording = async (
      selectedOwner: string,
      requestId: string,
      subjectId: string,
    ) => {
      const result = sql(`select s.song_isrc from context_requests r join context_subjects s
        on r.output->'subjectIds' ? s.id::text where r.id=${quote(requestId)}
        and r.owner_id=${quote(selectedOwner)} and s.id=${quote(subjectId)} and s.kind='recording';`);
      if (!result) throw new Error("Recording is outside the request");
      return result;
    };
    const input = {
      subjectId: recording,
      collectionVersion: "live-v1",
      operation: "recording" as const,
      isrc,
    };
    const started = Date.now();
    const saved = (await collectContextMlc(owner, owner, request, input, {
      authorize,
      resolveRecording,
      rpc,
      getAccessToken: getRecoupMlcAccessToken,
    })) as { state: string; resultId: string; content: Record<string, unknown> };
    expect(saved.state).toBe("saved");
    expect(saved.content).toMatchObject({ identityConfirmed: false, ownershipVerified: false });
    const verified = JSON.parse(
      sql(`select jsonb_build_object(
      'resultId',r.id,'topic',r.topic,'kind',r.evidence_kind,'status',r.status,
      'sourceCount',count(rs.source_version_id),'sourceUrl',max(s.source_url),
      'sourceHttpStatus',max((v.content->>'httpStatus')::integer))
      from context_results r join context_result_sources rs on rs.result_id=r.id
      join context_source_versions v on v.id=rs.source_version_id
      join context_sources s on s.id=v.source_id
      where r.id=${quote(saved.resultId)} group by r.id;`),
    );
    expect(verified).toMatchObject({
      resultId: saved.resultId,
      topic: "mlc_recordings",
      kind: "observation",
      status: "accepted",
      sourceCount: 1,
      sourceHttpStatus: 200,
    });
    const reused = (await collectContextMlc(owner, owner, request, input, {
      authorize,
      resolveRecording,
      rpc,
      getAccessToken: async () => {
        throw new Error("Reuse called MLC again");
      },
    })) as { state: string; resultId: string };
    expect(reused).toMatchObject({ state: "reused", resultId: saved.resultId });
    const elapsedMs = Date.now() - started;
    const trace = {
      id: "scenario-027",
      kind: "scenario",
      label: "Test run 27 · MLC module",
      title: "Hate U · MLC recording lookup",
      startedAt: new Date(started).toISOString(),
      environment: "Live Recoup MLC lookup; disposable local PostgreSQL evidence",
      outcome: "partial",
      notes:
        "Opt-in collector test, not deployed workflow. MLC result is a candidate work link, not confirmed rights or ownership. Work detail is not attached to a composition subject in this run.",
      steps: [
        {
          id: "recording",
          title: "Confirm recording identity",
          status: "saved",
          input: { isrc, subjectId: recording, requestId: request },
          output: { isrc, matched: true },
          position: { x: 100, y: 200 },
        },
        {
          id: "mlc",
          title: "Find candidate MLC work",
          status: "saved",
          input: { dependsOn: ["recording"], isrc, provider: "MLC", operation: "recording" },
          output: {
            resultId: saved.resultId,
            content: saved.content,
            evidence: verified,
            elapsedMs,
            cost: "Not reported",
          },
          prompt: null,
          model: "none",
          cost: null,
          position: { x: 470, y: 200 },
        },
        {
          id: "reuse",
          title: "Reuse saved MLC evidence",
          status: "reused",
          input: { dependsOn: ["mlc"], sameRecording: true },
          output: { resultId: reused.resultId, providerCalledAgain: false },
          position: { x: 840, y: 200 },
        },
      ],
    };
    if (process.env.CONTEXT_TRACE_ROOT)
      writeFileSync(
        `${process.env.CONTEXT_TRACE_ROOT}/context-scenarios/run-027.json`,
        JSON.stringify(trace, null, 2),
      );
    console.info(
      "MLC collector verification",
      JSON.stringify({ resultId: saved.resultId, ...verified, reused: reused.state, elapsedMs }),
    );
  },
  90_000,
);
