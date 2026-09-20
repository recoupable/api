import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runContextRequest } from "../runContextRequest";
import { fetchSpotifyContext } from "../fetchSpotifyContext";

// Opt-in only: actual Spotify requests and an isolated local Postgres database.
describe.skipIf(process.env.CONTEXT_LIVE_TEST !== "1")(
  "live Spotify to persisted context to briefs",
  () => {
    it("ingests two related tracks, preserves identity, reuses artist context, and reads two briefs", async () => {
      const { processContextOperation } = await import("../processContextOperation");
      const { authorizeContextOwner } = await import("../authorizeContextOwner");
      const started = Date.now();
      const sql = (text: string) =>
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
          { input: text, encoding: "utf8" },
        ).trim();
      const quote = (value: unknown) =>
        "'" +
        (typeof value === "string" ? value : JSON.stringify(value)).replaceAll("'", "''") +
        "'";
      const rpc = async (name: string, args: Record<string, unknown>) => {
        if (!/^[a-z_]+$/.test(name) || Object.keys(args).some(k => !/^p_[a-z_]+$/.test(k)))
          throw new Error("Invalid SQL identifier");
        const output = sql(
          `select to_jsonb(public.${name}(${Object.entries(args)
            .map(([key, value]) => `${key} => ${quote(value)}`)
            .join(",")}));`,
        );
        return output ? JSON.parse(output) : null;
      };
      const actor = randomUUID();
      sql(
        `insert into public.accounts(id,name) values(${quote(actor)},'Context Engine local live test');`,
      );
      const { default: generateToken } = await import("@/lib/spotify/generateAccessToken");
      const auth = await generateToken();
      if (!auth.access_token) throw new Error("Spotify authentication failed");
      const token = auth.access_token;
      const providerCalls: string[] = [];
      const extract = async (id: string) => {
        providerCalls.push(id);
        return fetchSpotifyContext(id, token);
      };
      const authorize = (id: string, owner: string) =>
        authorizeContextOwner(id, owner === id ? undefined : owner);
      const dispatch = async (id: string, owner: string, request: string) =>
        runContextRequest(id, owner, request, { rpc, extract, authorize });
      const deps = { rpc, dispatch };
      const input = {
        action: "ingest",
        url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
        idempotency_key: "first",
      };
      const first = (await processContextOperation(actor, input, deps)) as {
        request: { id: string };
      };
      const read = await processContextOperation(
        actor,
        { action: "read", request_id: first.request.id },
        deps,
      );
      const firstDocuments = (await rpc("read_context_documents", {
        p_owner: actor,
        p_request: first.request.id,
      })) as Array<{ topic: string; text: string; id: string; version: number }>;
      const release = JSON.parse(firstDocuments.find(d => d.topic === "release_metadata")!.text);
      const artistId = release.artists[0].id;
      const top = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!top.ok) throw new Error(`Spotify related tracks HTTP ${top.status}`);
      const tracks = await top.json();
      const next = tracks.tracks.find(
        (t: { id: string; artists: Array<{ id: string }> }) =>
          t.id !== release.trackId && t.artists[0].id === artistId,
      );
      if (!next) throw new Error("No second track for the same primary artist");
      const second = (await processContextOperation(
        actor,
        { ...input, url: `https://open.spotify.com/track/${next.id}`, idempotency_key: "second" },
        deps,
      )) as { request: { id: string } };
      const secondDocuments = (await rpc("read_context_documents", {
        p_owner: actor,
        p_request: second.request.id,
      })) as typeof firstDocuments;
      const shared = firstDocuments.filter(
        d => d.topic === "artist_metadata" && JSON.parse(d.text).id === artistId,
      )[0];
      expect(secondDocuments.find(d => d.id === shared.id)?.version).toBe(shared.version);
      await processContextOperation(actor, input, deps);
      expect(providerCalls).toHaveLength(2);
      const creative = await processContextOperation(
        actor,
        { action: "brief", request_id: first.request.id, purpose: "creative_direction" },
        deps,
      );
      const pitch = await processContextOperation(
        actor,
        { action: "brief", request_id: second.request.id, purpose: "playlist_pitch" },
        deps,
      );
      expect(creative).toMatchObject({ readiness: "partial" });
      expect(pitch).toMatchObject({ readiness: "partial" });
      const directory = process.env.CONTEXT_TRACE_DIR;
      if (!directory) throw new Error("CONTEXT_TRACE_DIR is required");
      mkdirSync(directory, { recursive: true });
      const report = {
        startedAt: new Date(started).toISOString(),
        durationMs: Date.now() - started,
        storage: "isolated local Postgres; production untouched",
        actor,
        first: read,
        second: await processContextOperation(
          actor,
          { action: "read", request_id: second.request.id },
          deps,
        ),
        providerCalls,
        sharedArtistDocument: shared,
        firstDocuments,
        secondDocuments,
        creative,
        pitch,
        model: null,
        providerCostUsd: 0,
        limitations: [
          "No paid enrichment ran",
          "Briefs are partial metadata selections, not generated creative concepts",
          "Shared domain and SQL tested; deployed HTTP/MCP/workflow not exercised",
        ],
      };
      writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2));
      console.log(
        JSON.stringify({
          first: release.title,
          second: next.name,
          providerCalls: providerCalls.length,
          sharedArtist: JSON.parse(shared.text).name,
          artistRevision: shared.version,
          firstDocuments: firstDocuments.length,
          secondDocuments: secondDocuments.length,
          durationMs: report.durationMs,
          trace: `${directory}/report.json`,
        }),
      );
    }, 120000);
  },
);
