import { it } from "vitest";
import { z } from "zod";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { runPlannedContextModules } from "../planning/runPlannedContextModules";
import { runContextEnrichment } from "../enrichment/runContextEnrichment";
import { collectContextArtwork } from "../enrichment/collectContextArtwork";
import { collectContextSongSummary } from "../enrichment/collectContextSongSummary";
import { discoverContextArtistSources } from "../enrichment/discoverContextArtistSources";
import { collectContextArtistResearch } from "../enrichment/collectContextArtistResearch";
import { lookupMusicBrainzIsrc } from "../providers/lookupMusicBrainzIsrc";
import { collectContextSocials } from "../providers/collectContextSocials";
import { lookupSongstatsContext } from "../providers/lookupSongstatsContext";
import { fetchExpandedSpotifyContext } from "../fetchExpandedSpotifyContext";
import { createChartmetricTokenProvider } from "../providers/createChartmetricTokenProvider";
import { searchChartmetricContext } from "../providers/searchChartmetricContext";

// Explicit local diagnostic. Uses live services and approved model calls; never production DB writes.
it.skipIf(process.env.CONTEXT_FULL_REVIEW !== "1")(
  "runs a connected Spotify review with explicit gaps",
  async () => {
    process.loadEnvFile(process.env.CONTEXT_ENV_FILE!);
    const root = process.env.CONTEXT_TRACE_ROOT!;
    const path = `${root}/context-scenarios/run-026.json`;
    const previousRun = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
    const prior = JSON.parse(readFileSync(`${root}/context-scenarios/run-017.json`, "utf8"));
    const baseline = JSON.parse(
      readFileSync(`${root}/context-module-program/deployment-20260922/smoke.json`, "utf8"),
    );
    const requestId = baseline.output.request.id;
    const response = await fetch("https://api.recoupable.dev/api/context", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.RECOUP_API_KEY! },
      body: JSON.stringify({ action: "read", request_id: requestId }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Saved request read HTTP ${response.status}`);
    const { request } = await response.json();
    if (request.input?.url !== "https://open.spotify.com/track/2zpWJxfuyxqCYhpsAqH7Uh")
      throw new Error("This diagnostic is scoped to the reviewed Hate U recording");
    const owner = request.owner_id;
    const artist = request.output.artists[0];
    const recording = request.output.subjectIds[0];
    const release = request.output.subjectIds[1];
    if (!owner || !recording || !release) throw new Error("Saved request identities missing");
    const sql = (s: string) =>
      execFileSync(
        "/opt/homebrew/bin/psql",
        ["-h", "127.0.0.1", "-p", "55439", "-d", "postgres", "-XAt", "-v", "ON_ERROR_STOP=1"],
        { input: s, encoding: "utf8" },
      ).trim();
    const quote = (v: unknown) =>
      "'" + (typeof v === "string" ? v : JSON.stringify(v)).replaceAll("'", "''") + "'";
    const localRequest = previousRun?.localRequestId ?? randomUUID();
    if (!previousRun?.localRequestId)
      sql(`begin; insert into accounts(id) values(${quote(owner)}),(${quote(artist.artistId)}) on conflict do nothing; insert into songs(isrc) values('USAT22103065') on conflict do nothing;
insert into context_resources(id,provider,resource_kind,provider_id,canonical_url) values(${quote(localRequest)},'spotify','release','3vX9jU6Ix8t7XsAWLoZs10','https://open.spotify.com/album/3vX9jU6Ix8t7XsAWLoZs10');
insert into context_subjects(id,kind,song_isrc) values(${quote(recording)},'recording','USAT22103065') on conflict do nothing;
insert into context_subjects(id,kind,resource_id) values(${quote(release)},'release',${quote(localRequest)}) on conflict do nothing;
insert into context_subjects(id,kind,artist_id) values(${quote(artist.subjectId)},'artist',${quote(artist.artistId)}) on conflict do nothing;
insert into context_requests(id,owner_id,created_by,resource_id,idempotency_key,input_fingerprint,input,status,output) values(${quote(localRequest)},${quote(owner)},${quote(owner)},${quote(localRequest)},${quote(localRequest)},repeat('f',64),${quote(request.input)},'completed',${quote({ subjectIds: [recording, release, artist.subjectId] })});commit;`);
    for (const credited of request.output.artists) {
      sql(
        `insert into accounts(id) values(${quote(credited.artistId)}) on conflict do nothing; insert into context_subjects(id,kind,artist_id) values(${quote(credited.subjectId)},'artist',${quote(credited.artistId)}) on conflict do nothing;`,
      );
    }
    sql(
      `update context_requests set output=${quote({ subjectIds: request.output.subjectIds })} where id=${quote(localRequest)};`,
    );
    const rpc = async (name: string, args: Record<string, unknown>) => {
      if (
        ![
          "claim_context_enrichment",
          "complete_context_enrichment",
          "fail_context_enrichment",
        ].includes(name)
      )
        throw new Error("Unapproved local operation");
      return JSON.parse(
        sql(
          `select public.${name}(${Object.entries(args)
            .map(([k, v]) => `${k}=>${quote(v)}`)
            .join(",")});`,
        ),
      );
    };
    const authorize = async (a: string, o: string) => {
      if (a !== owner || o !== owner) throw new Error("Wrong diagnostic workspace");
    };
    const deps = { rpc, authorize };
    const trace: any = {
      id: "scenario-026",
      kind: "scenario",
      label: "Test run 26 · connected context review",
      title: "Hate U · connected context collection",
      startedAt: new Date().toISOString(),
      environment: "Live providers + explicitly reused prior audio; local PostgreSQL evidence",
      outcome: "running",
      localRequestId: localRequest,
      notes:
        "Local diagnostic runner, not the deployed durable workflow. Existing Recoup request access verified. No production context writes. Reused audio outputs retain original provenance; model claims need human review.",
      priorPass: previousRun
        ? { startedAt: previousRun.startedAt, outcomes: previousRun.outcomes }
        : null,
      steps: [],
    };
    const save = () => writeFileSync(path, JSON.stringify(trace, null, 2));
    save();
    const values: Record<string, any> = {};
    const jobs: Record<string, () => Promise<any>> = {};
    const plan: any[] = [];
    const add = (
      key: string,
      title: string,
      dependsOn: string[],
      call: (() => Promise<any>) | null,
      reason?: string,
    ) => {
      plan.push({
        key,
        dependsOn,
        state: call ? "ready_for_dispatch" : "blocked",
        reasons: reason ? [reason] : [],
      });
      if (call) jobs[key] = call;
      trace.steps.push({
        id: key,
        title,
        status: call ? "pending" : "blocked",
        input: { dependsOn },
        output: reason ? { gap: reason } : null,
        position: { x: (plan.length % 4) * 360, y: Math.floor(plan.length / 4) * 260 },
      });
    };
    const persist = async (
      topic: string,
      subjectId: string,
      content: unknown,
      source: string,
      provider = "diagnostic-source",
    ) =>
      runContextEnrichment(
        owner,
        owner,
        localRequest,
        {
          key: `review-${topic}-v1`,
          topic,
          subjectId,
          provider,
          model: "none",
          evidenceKind: "observation",
          input: {
            source,
            hash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
          },
          sources: [{ url: source, kind: "provider_metadata", content }],
        },
        {
          ...deps,
          call: async () => ({
            content,
            coverage: "partial",
            trace: { source },
            costUsd: null,
            costStatus: "unknown",
          }),
        },
      );
    add("identity", "Read confirmed song, release and artists", [], async () => ({
      state: "reused",
      content: request,
      sourceRequest: requestId,
    }));
    add("spotify", "Read release and all credited artist profiles", ["identity"], async () => {
      const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(20000),
      });
      if (!tokenResponse.ok) throw new Error(`Spotify authentication HTTP ${tokenResponse.status}`);
      const token = await tokenResponse.json();
      const data = await fetchExpandedSpotifyContext(
        {
          releaseId: "3vX9jU6Ix8t7XsAWLoZs10",
          artistIds: request.output.artists.map((a: any) => a.providerId),
        },
        token.access_token,
      );
      return persist(
        "spotify_release_context",
        release,
        data,
        "https://api.spotify.com/v1/albums/3vX9jU6Ix8t7XsAWLoZs10",
        "spotify",
      );
    });
    for (const [key, preset, topic] of [
      ["audio", "catalog_metadata", "catalog_metadata"],
      ["lyrics", "lyric_transcription", "lyrics"],
    ])
      add(key, `Reuse full-audio ${key} from test 17`, ["identity"], async () => {
        const old = prior.steps.find((s: any) => s.id === preset);
        if (!old || old.status !== "saved") throw new Error("Prior evidence unavailable");
        const result = await persist(
          topic,
          recording,
          {
            analysis: old.output,
            sourceRun: prior.id,
            originalInput: old.input,
            limitations: prior.notes,
          },
          `urn:recoup:review:${prior.id}:${preset}`,
        );
        return {
          ...z.record(z.string(), z.unknown()).parse(result),
          state: "reused",
          reuseMeaning: "Previously collected provider output imported into local evidence store",
        };
      });
    add("musicbrainz", "Look up recording credits and other releases", ["identity"], async () =>
      persist(
        "musicbrainz_recordings",
        recording,
        await lookupMusicBrainzIsrc("USAT22103065", async () => {}),
        "https://musicbrainz.org/ws/2/isrc/USAT22103065",
        "musicbrainz",
      ),
    );
    add(
      "songstats",
      "Look up other platform links and available song information",
      ["identity"],
      async () =>
        persist(
          "songstats_context",
          recording,
          await lookupSongstatsContext({ kind: "recording", isrc: "USAT22103065" }),
          "https://api.songstats.com/enterprise/v1/tracks/info",
          "songstats",
        ),
    );
    add("chartmetric", "Find candidate Chartmetric artist profiles", ["identity"], async () => {
      const token = await createChartmetricTokenProvider(process.env.CHARTMETRIC_REFRESH_TOKEN!)();
      return persist(
        "chartmetric_candidates",
        artist.subjectId,
        await searchChartmetricContext({ query: "chillpill", type: "artists", limit: 5 }, token),
        "https://api.chartmetric.com/api/search",
        "chartmetric",
      );
    });
    add("artwork", "Describe cover colors, typography and visual style", ["spotify"], async () => {
      const data = values.spotify.content.results.find(
        (r: any) => r.kind === "albums" && r.status === "saved",
      ).data;
      return collectContextArtwork(
        owner,
        owner,
        localRequest,
        {
          releaseSubjectId: release,
          artworkUrl: data.images[0].url,
          assetVersion: data.images[0].url,
        },
        deps,
      );
    });
    add(
      "search",
      "Find primary artist biography and interview sources",
      ["identity"],
      async () => ({
        state: "saved",
        content: await discoverContextArtistSources({
          artistName: "chillpill",
          spotifyId: artist.providerId,
          releaseTitle: "Hate U",
        }),
      }),
    );
    add("research", "Build a sourced primary artist profile", ["search"], async () =>
      collectContextArtistResearch(
        owner,
        owner,
        localRequest,
        {
          artistSubjectId: artist.subjectId,
          artistName: "chillpill",
          spotifyId: artist.providerId,
          sources: values.search.content.sources,
        },
        deps,
      ),
    );
    add("summary", "Summarize sound and supported lyrical themes", ["audio", "lyrics"], async () =>
      collectContextSongSummary(
        owner,
        owner,
        localRequest,
        {
          recordingSubjectId: recording,
          audio: {
            recordingSubjectId: recording,
            resultId: values.audio.resultId,
            coverage: "partial",
            content: values.audio.content,
          },
          lyrics: {
            recordingSubjectId: recording,
            resultId: values.lyrics.resultId,
            coverage: "partial",
            content: values.lyrics.content,
          },
        },
        deps,
      ),
    );
    add(
      "socials",
      "Read authorized saved artist profiles and post metrics",
      ["identity"],
      async () =>
        persist(
          "social_context",
          artist.subjectId,
          await collectContextSocials(owner, artist.artistId),
          `urn:recoup:artist:${artist.artistId}:socials`,
          "recoup",
        ),
    );
    for (const [index, credited] of request.output.artists.entries()) {
      if (index === 0) continue;
      const name = index === 1 ? "Sueco" : "Lonely God";
      add(`search_${index}`, `Find research sources for ${name}`, ["identity"], async () => ({
        state: "saved",
        content: await discoverContextArtistSources({
          artistName: name,
          spotifyId: credited.providerId,
          releaseTitle: "Hate U",
        }),
      }));
      add(
        `research_${index}`,
        `Build a sourced profile for ${name}`,
        [`search_${index}`],
        async () =>
          collectContextArtistResearch(
            owner,
            owner,
            localRequest,
            {
              artistSubjectId: credited.subjectId,
              artistName: name,
              spotifyId: credited.providerId,
              sources: values[`search_${index}`].content.sources,
            },
            deps,
          ),
      );
    }
    for (const [key, title, reason] of [
      [
        "mlc",
        "Find writers and publishers",
        "No authorized MLC token configured locally; do not infer rights.",
      ],
      [
        "valuation",
        "Read catalog valuation",
        "No authorized catalog relationship resolved for this track.",
      ],
      [
        "luminate",
        "Read Luminate performance",
        "No authorized Luminate connection in this runner.",
      ],
      [
        "dsp",
        "Confirm Apple Music and YouTube Music matches",
        "Songstats may return links; dedicated identity confirmation not connected.",
      ],
    ])
      add(key, title, ["identity"], null, reason);
    trace.edges = plan.flatMap(node =>
      node.dependsOn.map((dep: string) => ({
        id: `${dep}-${node.key}`,
        source: dep,
        target: node.key,
        type: "smoothstep",
        markerEnd: { type: "arrowclosed" },
      })),
    );
    trace.plan = plan;
    save();
    const outcomes = await runPlannedContextModules(
      plan,
      {
        authorize: async () => authorize(owner, owner),
        dispatch: async node => {
          const step = trace.steps.find((s: any) => s.id === node.key);
          step.startedAt = new Date().toISOString();
          step.status = "running";
          save();
          const earlier = previousRun?.steps?.find((s: any) => s.id === node.key);
          if (earlier && ["saved", "reused"].includes(earlier.status) && earlier.output?.state) {
            const value = { ...earlier.output, state: "reused" };
            values[node.key] = value;
            step.output = value;
            step.reusedFrom = {
              run: previousRun.id,
              startedAt: earlier.startedAt,
              elapsedMs: earlier.elapsedMs,
            };
            save();
            return value;
          }
          if (earlier?.status === "failed" && !["spotify", "socials"].includes(node.key)) {
            step.output = earlier.output;
            throw new Error("Prior failed provider attempt retained; no automatic retry");
          }
          const start = Date.now();
          try {
            const value = await jobs[node.key]();
            values[node.key] = value;
            step.output = value;
            return value;
          } catch (e) {
            step.output = { error: e instanceof Error ? e.message : "Collection failed" };
            throw e;
          } finally {
            step.elapsedMs = Date.now() - start;
            save();
          }
        },
        persistOutcome: async outcome => {
          const step = trace.steps.find((s: any) => s.id === outcome.key);
          step.status = outcome.status;
          if (outcome.status === "blocked")
            step.output = {
              ...step.output,
              reasons: outcome.reasons,
              blockedBy: outcome.blockedBy,
            };
          save();
        },
      },
      4,
    );
    trace.outcome = outcomes.some(o => o.status === "failed" || o.status === "blocked")
      ? "partial"
      : "passed";
    for (const step of trace.steps) {
      const resultId = step.output?.resultId;
      if (!resultId) continue;
      const evidence = JSON.parse(
        sql(
          `select jsonb_build_object('input',a.input,'trace',r.raw_response,'model',a.model,'cost',a.provider_cost_micros) from context_results r join context_attempts a on a.id=r.attempt_id where r.id=${quote(resultId)} and r.owner_id=${quote(owner)};`,
        ),
      );
      step.input = { ...step.input, module: evidence.input };
      step.trace = evidence.trace;
      step.prompt = evidence.input?.input?.system ?? null;
      step.model = evidence.model;
      step.cost = evidence.cost === null ? null : evidence.cost / 1000000;
    }
    trace.elapsedMs = Date.now() - Date.parse(trace.startedAt);
    trace.finishedAt = new Date().toISOString();
    trace.localRequestId = localRequest;
    trace.outcomes = outcomes;
    save();
    console.log(
      JSON.stringify({
        run: trace.id,
        outcome: trace.outcome,
        steps: trace.steps.map((s: any) => ({ id: s.id, status: s.status })),
      }),
    );
  },
  600000,
);
