import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { generateObject } from "ai";
import { z } from "zod";
import {
  runContextEnrichment,
  type ContextEnrichmentResult,
} from "../enrichment/runContextEnrichment";
import { callContextMusicPreset } from "../enrichment/callContextMusicPreset";
import { SONG_SUMMARY_PROMPT, ARTWORK_PROMPT, RESEARCH_PROMPT } from "../enrichment/prompts";

// Explicitly approved manual paid test only. No retries, no deployment, no site generation.
describe.skipIf(process.env.CONTEXT_PAID_TEST !== "1")("paid context enrichment", () => {
  it("persists independently traced analyses and reads reusable briefs", async () => {
    const dir = process.env.CONTEXT_TRACE_DIR!;
    if (!dir) throw new Error("Trace directory required");
    mkdirSync(dir, { recursive: true });
    const save = (name: string, value: unknown) =>
      writeFileSync(`${dir}/${name}.json`, JSON.stringify(value, null, 2));
    const baseline = JSON.parse(readFileSync(process.env.CONTEXT_BASELINE!, "utf8"));
    const actor = baseline.actor;
    const request = baseline.first.request;
    const releaseDoc = baseline.firstDocuments.find((d: any) => d.topic === "release_metadata");
    const release = JSON.parse(releaseDoc.text);
    const sql = (input: string) =>
      execFileSync(
        "/opt/homebrew/bin/psql",
        [
          "-h",
          "127.0.0.1",
          "-p",
          "55439",
          "-d",
          "context_final",
          "-X",
          "-A",
          "-t",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        { input, encoding: "utf8" },
      ).trim();
    const quote = (v: unknown) =>
      "'" + (typeof v === "string" ? v : JSON.stringify(v)).replaceAll("'", "''") + "'";
    const rpc = async (name: string, args: Record<string, unknown>) => {
      if (!/^[a-z_]+$/.test(name) || Object.keys(args).some(k => !/^p_[a-z_]+$/.test(k)))
        throw new Error("Invalid identifier");
      const value = sql(
        `select to_jsonb(public.${name}(${Object.entries(args)
          .map(([k, v]) => `${k} => ${quote(v)}`)
          .join(",")}));`,
      );
      return value ? JSON.parse(value) : null;
    };
    const subjects = JSON.parse(
      sql(
        `select jsonb_agg(jsonb_build_object('id',id,'kind',kind)) from public.context_subjects where id in (${request.output.subjectIds.map(quote).join(",")});`,
      ),
    );
    const recording = subjects.find((s: any) => s.kind === "recording").id;
    const artist = request.output.artists[0].subjectId;
    const { authorizeContextOwner } = await import("../authorizeContextOwner");
    const authorize = (id: string, owner: string) =>
      authorizeContextOwner(id, owner === id ? undefined : owner);
    const audioSources = [
      {
        url: release.previewUrl,
        kind: "audio",
        content: { coverage: "preview", trackId: release.trackId },
      },
    ];
    const results: Record<string, any> = {};
    const started = Date.now();
    const stage = async (
      topic: string,
      subjectId: string,
      provider: string,
      model: string,
      input: unknown,
      sources: any[],
      call: () => Promise<ContextEnrichmentResult>,
    ) => {
      const module = {
        key: `${topic}-pilot-v1`,
        topic,
        subjectId,
        provider,
        model,
        input,
        sources,
      };
      try {
        results[topic] = await runContextEnrichment(actor, actor, request.id, module, {
          rpc,
          authorize,
          call: async () => {
            save(`${topic}-started`, { startedAt: new Date().toISOString(), module });
            const result = await call();
            save(`${topic}-response`, result); // Checkpoint before DB write.
            return result;
          },
        });
        save(`${topic}-saved`, results[topic]);
        console.log(`${topic}: ${results[topic].state}`);
      } catch (error) {
        results[topic] = { error: error instanceof Error ? error.message : String(error) };
        save(`${topic}-failure`, results[topic]);
        console.log(`${topic}: failed; see trace`);
      }
    };
    const astra = async (
      system: string,
      input: unknown,
      schema: any,
      images: string[] = [],
    ): Promise<ContextEnrichmentResult> => {
      const t = Date.now();
      const messages = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: JSON.stringify(input) },
            ...images.map(image => ({ type: "image" as const, image: new URL(image) })),
          ],
        },
      ];
      const response = await generateObject({
        model: "openai/gpt-6-astra",
        system,
        messages,
        schema,
        maxRetries: 0,
        maxOutputTokens: 5000,
      });
      const metadata = response.providerMetadata as any;
      const reportedCost = metadata?.gateway?.cost;
      const cost =
        reportedCost !== undefined && reportedCost !== null && reportedCost !== ""
          ? Number(reportedCost)
          : NaN;
      return {
        content: response.object,
        coverage: "partial",
        costUsd: Number.isFinite(cost) && cost >= 0 ? cost : null,
        costStatus: Number.isFinite(cost) && cost >= 0 ? "confirmed" : "unknown",
        trace: {
          model: "openai/gpt-6-astra",
          system,
          messages,
          request: response.request,
          response: response.response,
          usage: response.usage,
          providerMetadata: metadata,
          elapsedMs: Date.now() - t,
          billing:
            "Approved internal test via AI Gateway; no customer-wallet debit by this harness.",
        },
      };
    };
    // Database contract probe: rollback proves the persistence path before paid calls.
    sql(`begin; select public.claim_context_enrichment(${quote(actor)},${quote(request.id)},${quote({ key: "probe", topic: "lyrics", subjectId: recording, provider: "fixture", model: "fixture", sources: audioSources, fingerprint: "a".repeat(64) })}) as claim \\gset
select public.complete_context_enrichment(${quote(actor)},${quote(request.id)},(:'claim'::jsonb->>'attemptId')::uuid,${quote({ content: { probe: true }, coverage: "partial", trace: { fixture: true }, costUsd: 0, costStatus: "confirmed" })}); rollback;`);
    for (const [topic, preset] of [
      ["catalog_metadata", "catalog_metadata"],
      ["lyrics", "lyric_transcription"],
    ] as const)
      await stage(
        topic,
        recording,
        "recoup-production",
        "nvidia/music-flamingo-2601-hf",
        { audio_url: release.previewUrl, preset },
        audioSources,
        () => callContextMusicPreset(release.previewUrl, preset, process.env.RECOUP_API_KEY!),
      );
    if (results.catalog_metadata?.content && results.lyrics?.content) {
      const input = {
        title: release.title,
        coverage: "preview",
        catalog: results.catalog_metadata.content,
        transcript: results.lyrics.content,
      };
      await stage(
        "song_summary",
        recording,
        "ai-gateway",
        "openai/gpt-6-astra",
        { system: SONG_SUMMARY_PROMPT, input },
        audioSources,
        () =>
          astra(
            SONG_SUMMARY_PROMPT,
            input,
            z.object({
              summary: z.string(),
              audibleCharacteristics: z.array(z.string()),
              supportedThemes: z.array(z.string()),
              uncertainties: z.array(z.string()),
              coverage: z.literal("preview"),
            }),
          ),
      );
    }
    const artwork = release.release.artwork[0].url;
    await stage(
      "artwork_branding",
      releaseDoc.subjectId,
      "ai-gateway",
      "openai/gpt-6-astra",
      { system: ARTWORK_PROMPT, artwork },
      [{ url: artwork, kind: "artwork", content: { releaseId: release.release.id } }],
      () =>
        astra(
          ARTWORK_PROMPT,
          { title: release.title },
          z.object({
            visibleObservations: z.array(z.string()),
            palette: z.array(z.object({ color: z.string(), role: z.string() })),
            typography: z.string(),
            composition: z.string(),
            texturesAndMaterials: z.array(z.string()),
            motifs: z.array(z.string()),
            visualInterpretation: z.string(),
            uncertainties: z.array(z.string()),
          }),
          [artwork],
        ),
    );
    const query = {
      query: 'chillpill music producer "LiLBiTcH" Rico Nasty Soleima artist interview',
      max_results: 5,
      max_tokens_per_page: 1200,
    };
    let search: any;
    if (existsSync(`${dir}/research-search-response.json`))
      search = JSON.parse(readFileSync(`${dir}/research-search-response.json`, "utf8")).response;
    else if (!existsSync(`${dir}/research-search-started.json`)) {
      save("research-search-started", { query, startedAt: new Date().toISOString() });
      const t = Date.now();
      const { searchPerplexity } = await import("@/lib/perplexity/searchPerplexity");
      search = await searchPerplexity(query);
      save("research-search-response", {
        query,
        response: search,
        elapsedMs: Date.now() - t,
        costUsd: null,
        costStatus: "unknown",
      });
    }
    if (search?.results?.length) {
      const input = {
        artist: release.artists[0],
        spotifyUrl: `https://open.spotify.com/artist/${release.artists[0].id}`,
        sources: search.results,
      };
      await stage(
        "artist_research",
        artist,
        "ai-gateway",
        "openai/gpt-6-astra",
        { system: RESEARCH_PROMPT, input },
        search.results.map((r: any) => ({ url: r.url, kind: "web", content: r })),
        async () => {
          const result = await astra(
            RESEARCH_PROMPT,
            input,
            z.object({
              artist: z.string(),
              claims: z.array(
                z.object({ claim: z.string(), sourceUrl: z.string(), date: z.string().nullable() }),
              ),
              identityCautions: z.array(z.string()),
              missingContext: z.array(z.string()),
            }),
          );
          save("artist-research-unvalidated", result);
          const content = result.content as any;
          if (
            content.claims.some((c: any) => !search.results.some((r: any) => r.url === c.sourceUrl))
          )
            throw new Error("Unsupported research citation");
          return result;
        },
      );
    }
    const documents = await rpc("read_context_documents", {
      p_owner: actor,
      p_request: request.id,
    });
    const { processContextOperation } = await import("../processContextOperation");
    const briefs: Record<string, unknown> = {};
    for (const purpose of ["creative_direction", "playlist_pitch"])
      briefs[purpose] = await processContextOperation(
        actor,
        { action: "brief", request_id: request.id, purpose, max_characters: 32000 },
        { rpc, dispatch: async () => {} },
      );
    save("report", {
      startedAt: new Date(started).toISOString(),
      elapsedMs: Date.now() - started,
      requestId: request.id,
      track: release.title,
      results,
      documents,
      briefs,
      limitations: [
        "Preview only; full song and full lyrics unavailable",
        "Local persistence; production deployment and public paid dispatch not tested",
        "Research uses search snippets, not independently fetched full articles",
        "Unknown costs are not zero",
      ],
    });
    expect(Object.values(results).filter((r: any) => r.error)).toHaveLength(0);
    expect(Object.keys(results)).toHaveLength(5);
  }, 1800000);
});
