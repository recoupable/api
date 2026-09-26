import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { expect, it, vi } from "vitest";
import { runRecordedContextModules } from "../planning/runRecordedContextModules";
import { runRecordedReleaseTrackIsrcs } from "../planning/runRecordedReleaseTrackIsrcs";
import { runReleaseVerification } from "../planning/runReleaseVerification";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));

// Explicit opt-in against a disposable PostgreSQL fixture with DB PR77 staged.
// The whole test shares one transaction and rolls it back, including failures.
it.skipIf(process.env.CONTEXT_LOCAL_RELEASE_DATABASE_TEST !== "1")(
  "saves release and track evidence through authenticated operations and real SQL",
  async () => {
    const child = spawn(
      "/opt/homebrew/opt/postgresql@17/bin/psql",
      [
        "-h",
        "127.0.0.1",
        "-p",
        process.env.CONTEXT_LOCAL_POSTGRES_PORT ?? "55440",
        "-d",
        "postgres",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let pending:
        | { marker: string; resolve: (value: string) => void; reject: (error: Error) => void }
        | undefined,
      buffer = "",
      errors = "";
    child.stdout.on("data", chunk => {
      buffer += chunk.toString();
      if (!pending || !buffer.includes(pending.marker)) return;
      const value = buffer.slice(0, buffer.indexOf(pending.marker)).trim();
      buffer = buffer.slice(buffer.indexOf(pending.marker) + pending.marker.length).trimStart();
      const current = pending;
      pending = undefined;
      current.resolve(value);
    });
    child.stderr.on("data", chunk => {
      errors += chunk.toString();
    });
    child.on("error", error => pending?.reject(error));
    child.on("exit", code => pending?.reject(new Error(`Local psql exited ${code}: ${errors}`)));
    const query = (sql: string) =>
      new Promise<string>((resolve, reject) => {
        if (pending) return reject(new Error("Concurrent fixture SQL is unsupported"));
        const marker = `END_${randomUUID().replaceAll("-", "")}`;
        pending = { marker, resolve, reject };
        child.stdin.write(`${sql}\n\\echo ${marker}\n`);
      });
    const quote = (value: unknown) =>
      `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
    try {
      const owner = randomUUID(),
        outsider = randomUUID();
      const album = "3vX9jU6Ix8t7XsAWLoZs10";
      const key = `release-local-${randomUUID()}`;
      await query(
        `begin;create temporary table rpc_output(value jsonb) on commit drop;` +
          `create table if not exists public.songs(isrc text primary key,name text not null,album text not null,lyrics text not null);` +
          `create table if not exists public.song_identifiers(song text not null references public.songs(isrc),platform text not null,identifier_type text not null,value text not null);` +
          `insert into public.accounts(id,name) values(${quote(owner)},'Owner'),(${quote(outsider)},'Other workspace');`,
      );
      const rpcCalls: string[] = [];
      const rpc = async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push(name);
        if (
          ![
            "create_context_release_request",
            "list_context_release_request_target",
            "resolve_context_spotify_release",
            "claim_context_enrichment",
            "complete_context_enrichment",
            "fail_context_enrichment",
            "save_context_spotify_release_track_slots",
            "list_context_release_track_slots",
            "create_context_execution",
            "claim_context_execution_node",
            "save_context_execution_outcome",
            "claim_context_release_track_isrcs",
            "complete_context_release_track_isrcs",
            "review_context_release_track_identities",
          ].includes(name)
        )
          throw new Error("Unexpected fixture RPC");
        const params = Object.entries(args)
          .map(([field, value]) => {
            if (!/^p_[a-z_]+$/.test(field)) throw new Error("Unexpected RPC parameter");
            return `${field} => ${quote(value)}`;
          })
          .join(",");
        // A direct statement keeps this status change visible inside the shared fixture transaction.
        if (name === "fail_context_enrichment") {
          const value = JSON.parse(
            await query(`select to_jsonb(public.fail_context_enrichment(${params}));`),
          );
          expect(value).toBe(true);
          return value;
        }
        const raw = await query(
          `do $rpc$ begin begin insert into rpc_output select public.${name}(${params});` +
            `exception when others then insert into rpc_output values(jsonb_build_object('testError',SQLERRM));` +
            `end;end $rpc$;select value from rpc_output;truncate rpc_output;`,
        );
        const result = JSON.parse(raw);
        if (result.testError) throw new Error(result.testError);
        return result;
      };
      const dispatch = vi.fn();
      const input = {
        action: "ingest_release",
        url: `https://open.spotify.com/album/${album}?si=sharing`,
        idempotency_key: key,
      };
      const deps = {
        authorize: async () => ({ accountId: owner, ownerId: owner, organizationId: null }),
        rpc,
        dispatch,
      };
      const first = await processContextOperation(owner, input, deps);
      const again = await processContextOperation(owner, input, deps);
      if (!("request" in first) || !("request" in again))
        throw new Error("Missing release request");
      expect(first.request.status).toBe("partial");
      expect(again.request.id).toBe(first.request.id);
      const target = (await rpc("list_context_release_request_target", {
        p_owner: owner,
        p_request: first.request.id,
      })) as {
        subjectId: string;
        kind: string;
        identityConfirmed: boolean;
        availableFields: string[];
      };
      expect(target).toMatchObject({
        kind: "release",
        identityConfirmed: false,
        availableFields: ["spotify_id"],
      });
      await expect(
        rpc("list_context_release_request_target", {
          p_owner: outsider,
          p_request: first.request.id,
        }),
      ).rejects.toThrow();
      expect(dispatch).not.toHaveBeenCalled();

      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json({
          id: album,
          name: "Fixture release",
          tracks: {
            items: [
              { id: "5vX9jU6Ix8t7XsAWLoZs10", type: "track", disc_number: 1, track_number: 1 },
              { id: "6vX9jU6Ix8t7XsAWLoZs10", type: "track", disc_number: 1, track_number: 2 },
            ],
            offset: 0,
            total: 2,
            next: null,
          },
        }),
      );
      vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
      const record: typeof runRecordedContextModules = (execution, callbacks) =>
        runRecordedContextModules(execution, {
          ...callbacks,
          createExecution: async (
            selectedOwner,
            selectedRequest,
            executionId,
            policyVersion,
            plan,
          ) =>
            (await rpc("create_context_execution", {
              p_owner: selectedOwner,
              p_request: selectedRequest,
              p_execution: executionId,
              p_policy_version: policyVersion,
              p_plan: plan,
            })) as { id: string; created: boolean },
          claimNode: async (selectedOwner, executionId, nodeKey) =>
            (await rpc("claim_context_execution_node", {
              p_owner: selectedOwner,
              p_execution: executionId,
              p_node_key: nodeKey,
            })) as { state: "claimed"; claimId: string },
          saveOutcome: (selectedOwner, executionId, outcome) =>
            rpc("save_context_execution_outcome", {
              p_owner: selectedOwner,
              p_execution: executionId,
              p_node_key: outcome.key,
              p_outcome: outcome,
            }),
        });
      const verification = () =>
        runReleaseVerification(owner, owner, first.request.id, {
          authorize: deps.authorize,
          rpc,
          record,
          getSpotifyToken: async () => "fixture-token",
          fetcher,
        });
      let run: Awaited<ReturnType<typeof runReleaseVerification>> | undefined;
      const queued = await processContextOperation(
        owner,
        { action: "verify_release", request_id: first.request.id },
        {
          ...deps,
          dispatchRelease: async () => {
            run = await verification();
          },
        },
      );
      expect(queued).toEqual({ request_id: first.request.id, verificationQueued: true });
      if (!run) throw new Error("Release verification did not execute in the fixture");
      expect(run.outcomes).toMatchObject([{ status: "saved" }]);
      expect(fetcher).toHaveBeenCalledOnce();
      await expect(verification()).rejects.toThrow("reconciliation");
      expect(fetcher).toHaveBeenCalledOnce();
      const evidence = JSON.parse(
        await query(
          `select jsonb_build_object('kind',r.evidence_kind,'album',r.normalized_response->'album'->>'id',` +
            `'sourceCount',(select count(*) from public.context_result_sources rs where rs.result_id=r.id))` +
            ` from public.context_results r where r.owner_id=${quote(owner)}` +
            ` and r.subject_id=${quote(target.subjectId)} and r.topic='spotify_release_context'` +
            ` and r.status='accepted' order by r.created_at desc limit 1;`,
        ),
      );
      expect(evidence).toMatchObject({ kind: "observation", album, sourceCount: 1 });
      const recorded = JSON.parse(
        await query(
          `select jsonb_build_object('status',outcome->>'status','resultId',outcome->'receipt'->>'resultId')` +
            ` from public.context_execution_outcomes where execution_id=${quote(run.executionId)}` +
            ` and owner_id=${quote(owner)} and node_key=${quote(`${target.subjectId}:spotify_release`)};`,
        ),
      );
      expect(recorded).toMatchObject({ status: "saved", resultId: expect.any(String) });
      const slots = JSON.parse(
        await query(
          `select jsonb_agg(jsonb_build_object('slot',s.slot_index,'trackId',r.provider_id) order by s.slot_index)` +
            ` from public.context_release_track_slots s join public.context_resources r on r.id=s.track_resource_id` +
            ` where s.owner_id=${quote(owner)} and s.release_subject_id=${quote(target.subjectId)}` +
            ` and s.source_result_id=${quote(recorded.resultId)};`,
        ),
      );
      expect(slots).toEqual([
        { slot: 0, trackId: "5vX9jU6Ix8t7XsAWLoZs10" },
        { slot: 1, trackId: "6vX9jU6Ix8t7XsAWLoZs10" },
      ]);
      const trackPage = await processContextOperation(
        owner,
        {
          action: "list_release_tracks",
          request_id: first.request.id,
          subject_id: target.subjectId,
        },
        deps,
      );
      expect(trackPage).toMatchObject({
        page: {
          state: "ready",
          linkedSlots: 2,
          slots: [
            { slotIndex: 0, spotifyTrackId: "5vX9jU6Ix8t7XsAWLoZs10" },
            { slotIndex: 1, spotifyTrackId: "6vX9jU6Ix8t7XsAWLoZs10" },
          ],
        },
      });

      vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED", "true");
      const trackFetcher = vi.fn<typeof fetch>(async input => {
        const id = String(input).split("/").at(-1);
        return Response.json({
          id,
          external_ids: id === "5vX9jU6Ix8t7XsAWLoZs10" ? { isrc: "USABC2600001" } : {},
        });
      });
      const trackVerification = () =>
        runRecordedReleaseTrackIsrcs(owner, owner, first.request.id, target.subjectId, {
          authorize: deps.authorize,
          rpc,
          record,
          getSpotifyToken: async () => "fixture-token",
          fetcher: trackFetcher,
        });
      let trackRun: Awaited<ReturnType<typeof runRecordedReleaseTrackIsrcs>> | undefined;
      const queuedTracks = await processContextOperation(
        owner,
        {
          action: "verify_release_tracks",
          request_id: first.request.id,
          subject_id: target.subjectId,
        },
        {
          ...deps,
          dispatchReleaseTracks: async () => {
            trackRun = await trackVerification();
          },
        },
      );
      expect(queuedTracks).toEqual({
        request_id: first.request.id,
        subject_id: target.subjectId,
        lookupQueued: true,
      });
      if (!trackRun) throw new Error("Release track lookup did not execute in the fixture");
      expect(trackRun.outcomes).toMatchObject([{ status: "saved" }]);
      expect(trackFetcher).toHaveBeenCalledTimes(2);
      await expect(trackVerification()).rejects.toThrow("reconciliation");
      expect(trackFetcher).toHaveBeenCalledTimes(2);
      const trackEvidence = JSON.parse(
        await query(
          `select jsonb_build_object('status',o.outcome->>'status',` +
            `'observed',r.normalized_response->'observedIsrcCount',` +
            `'missing',r.normalized_response->'missingIsrcCount',` +
            `'sourceCount',(select count(*) from public.context_result_sources rs where rs.result_id=r.id))` +
            ` from public.context_execution_outcomes o` +
            ` join public.context_results r on r.id=(o.outcome->'receipt'->>'resultId')::uuid` +
            ` where o.execution_id=${quote(trackRun.executionId)} and o.owner_id=${quote(owner)};`,
        ),
      );
      expect(trackEvidence).toEqual({ status: "saved", observed: 1, missing: 1, sourceCount: 3 });
      const identityReview = () =>
        processContextOperation(
          owner,
          {
            action: "review_release_track_identities",
            request_id: first.request.id,
            subject_id: target.subjectId,
          },
          deps,
        );
      expect(await identityReview()).toMatchObject({
        review: {
          state: "ready",
          candidates: [
            { observationState: "observed", isrc: "USABC2600001", mappingState: "unmapped" },
            { observationState: "missing_isrc", isrc: null, mappingState: "unresolved" },
          ],
        },
      });
      expect(await query("select count(*) from public.song_identifiers;")).toBe("0");
      await query(
        `insert into public.songs(isrc) values('USABC2600001');` +
          `insert into public.song_identifiers(song,platform,identifier_type,value)` +
          ` values('USABC2600001','spotify','track_id','5vX9jU6Ix8t7XsAWLoZs10');`,
      );
      expect(await identityReview()).toMatchObject({
        review: { candidates: [{ mappingState: "existing_identifier_match" }, {}] },
      });
      await query(
        `insert into public.songs(isrc) values('USABC2600003');` +
          `update public.song_identifiers set song='USABC2600003'` +
          ` where platform='spotify' and identifier_type='track_id' and value='5vX9jU6Ix8t7XsAWLoZs10';`,
      );
      expect(await identityReview()).toMatchObject({
        review: { candidates: [{ mappingState: "conflict" }, {}] },
      });
      expect(await query("select count(*) from public.song_identifiers;")).toBe("1");
      await expect(
        rpc("review_context_release_track_identities", {
          p_owner: outsider,
          p_request: first.request.id,
          p_subject: target.subjectId,
        }),
      ).rejects.toThrow();

      const partialAlbum = "7vX9jU6Ix8t7XsAWLoZs10";
      const partialEntry = await processContextOperation(
        owner,
        {
          action: "ingest_release",
          url: `https://open.spotify.com/album/${partialAlbum}`,
          idempotency_key: `${key}-partial-track-lookup`,
        },
        deps,
      );
      if (!("request" in partialEntry)) throw new Error("Missing partial release request");
      const partialTarget = (await rpc("list_context_release_request_target", {
        p_owner: owner,
        p_request: partialEntry.request.id,
      })) as { subjectId: string };
      const partialAlbumRun = await runReleaseVerification(owner, owner, partialEntry.request.id, {
        authorize: deps.authorize,
        rpc,
        record,
        getSpotifyToken: async () => "fixture-token",
        fetcher: async () =>
          Response.json({
            id: partialAlbum,
            name: "Partial fixture release",
            tracks: {
              items: [
                { id: "5vX9jU6Ix8t7XsAWLoZs10", type: "track", disc_number: 1, track_number: 1 },
                { id: "6vX9jU6Ix8t7XsAWLoZs10", type: "track", disc_number: 1, track_number: 2 },
              ],
              offset: 0,
              total: 2,
              next: null,
            },
          }),
      });
      expect(partialAlbumRun.outcomes).toMatchObject([{ status: "saved" }]);
      const partialTrackFetcher = vi.fn<typeof fetch>(async input =>
        String(input).endsWith("5vX9jU6Ix8t7XsAWLoZs10")
          ? new Response(null, { status: 429 })
          : Response.json({
              id: "6vX9jU6Ix8t7XsAWLoZs10",
              external_ids: { isrc: "USABC2600002" },
            }),
      );
      const partialTrackVerification = () =>
        runRecordedReleaseTrackIsrcs(
          owner,
          owner,
          partialEntry.request.id,
          partialTarget.subjectId,
          {
            authorize: deps.authorize,
            rpc,
            record,
            getSpotifyToken: async () => "fixture-token",
            fetcher: partialTrackFetcher,
          },
        );
      const partialTrackRun = await partialTrackVerification();
      expect(partialTrackRun.outcomes).toMatchObject([{ status: "saved" }]);
      const partialEvidence = JSON.parse(
        await query(
          `select jsonb_build_object('coverage',r.normalized_response->>'coverage',` +
            `'observed',r.normalized_response->'observedIsrcCount',` +
            `'failed',r.normalized_response->'failedLookupCount',` +
            `'sourceCount',(select count(*) from public.context_result_sources rs where rs.result_id=r.id))` +
            ` from public.context_execution_outcomes o` +
            ` join public.context_results r on r.id=(o.outcome->'receipt'->>'resultId')::uuid` +
            ` where o.execution_id=${quote(partialTrackRun.executionId)} and o.owner_id=${quote(owner)};`,
        ),
      );
      expect(partialEvidence).toEqual({
        coverage: "partial",
        observed: 1,
        failed: 1,
        sourceCount: 2,
      });
      await expect(partialTrackVerification()).rejects.toThrow("reconciliation");
      expect(partialTrackFetcher).toHaveBeenCalledTimes(2);
      await query(
        `update public.context_sources set withdrawn_at=now() where owner_id=${quote(owner)}` +
          ` and source_url='https://api.spotify.com/v1/tracks/5vX9jU6Ix8t7XsAWLoZs10';`,
      );
      expect(await identityReview()).toMatchObject({ review: { state: "not_collected" } });

      const failedAlbum = "4vX9jU6Ix8t7XsAWLoZs10";
      const failedInput = {
        action: "ingest_release",
        url: `https://open.spotify.com/album/${failedAlbum}`,
        idempotency_key: `${key}-provider-failure`,
      };
      const failedEntry = await processContextOperation(owner, failedInput, deps);
      if (!("request" in failedEntry)) throw new Error("Missing failed release request");
      const failedFetcher = vi.fn<typeof fetch>(async () => {
        throw new Error("Fixture provider connection ended without a response");
      });
      const failedVerification = () =>
        runReleaseVerification(owner, owner, failedEntry.request.id, {
          authorize: deps.authorize,
          rpc,
          record,
          getSpotifyToken: async () => "fixture-token",
          fetcher: failedFetcher,
        });
      const failedRun = await failedVerification();
      expect(failedRun.outcomes).toMatchObject([{ status: "failed", failureStage: "dispatch" }]);
      expect(rpcCalls).toContain("fail_context_enrichment");
      expect(failedFetcher).toHaveBeenCalledOnce();
      await expect(failedVerification()).rejects.toThrow("reconciliation");
      expect(failedFetcher).toHaveBeenCalledOnce();
      const failure = JSON.parse(
        await query(
          `select jsonb_build_object('outcome',o.outcome->>'status','attempt',a.status,` +
            `'evidenceCount',(select count(*) from public.context_results r where r.attempt_id=a.id))` +
            ` from public.context_execution_outcomes o` +
            ` join public.context_executions e on e.id=o.execution_id` +
            ` join public.context_attempts a on a.request_id=e.request_id and a.provider='spotify'` +
            ` where o.execution_id=${quote(failedRun.executionId)} and o.owner_id=${quote(owner)} limit 1;`,
        ),
      );
      expect(failure).toMatchObject({ outcome: "failed", attempt: "unknown", evidenceCount: 0 });
    } finally {
      vi.unstubAllEnvs();
      if (child.exitCode === null) {
        await query("rollback;");
        child.stdin.end("\\q\n");
      }
    }
  },
  30000,
);
