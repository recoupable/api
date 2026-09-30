import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { verifiedAudioWorker } from "../verifiedAudioWorker";

it("screens renamed featured credits without weakening lead-artist, version or duration matching", () => {
  // Exercise the shipped Python predicate without downloads or third-party Python dependencies.
  const script = `
import ast, re, sys
module=ast.parse(sys.stdin.read())
helpers=ast.Module(body=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in ('norm','matches_metadata')],type_ignores=[])
exec(compile(helpers,'worker','exec'))
recording={'title':'FUCK THE CLUB (feat. GOLDN)','artists':['chillpill','Joshua Golden'],'durationSeconds':154.79}
candidate={'title':'chillpill - FUCK THE CLUB (feat. GOLDN)','duration':155}
assert matches_metadata(candidate,recording)
assert matches_metadata({**candidate,'title':'chillpill - F*ck The Club (ft. GOLDN)'},recording)
assert matches_metadata({**candidate,'title':'chillpill - F**k The Club'},recording)
assert not matches_metadata({**candidate,'title':'chillpill - Leave The Club'},recording)
assert not matches_metadata({**candidate,'title':'Someone else - FUCK THE CLUB'},recording)
assert not matches_metadata({**candidate,'duration':180},recording)
assert not matches_metadata({**candidate,'title':candidate['title']+' sped up'},recording)
`;
  const result = spawnSync("python3", ["-c", script], {
    input: verifiedAudioWorker,
    encoding: "utf8",
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});

// The deployed audio worker installs NumPy. Exercise its numerical code locally where available.
it.skipIf(spawnSync("python3", ["-c", "import numpy"]).status !== 0)(
  "refines fractional sample alignment without accepting unrelated audio",
  () => {
    const result = spawnSync("python3", ["lib/context/audio/__tests__/verifyAudioAlignment.py"], {
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).aligned_correlation).toBeGreaterThan(0.95);
  },
);

it("uses exact artist/title discovery and broadens only when no eligible result exists", () => {
  const script = `
import ast, re, sys, json
module=ast.parse(sys.stdin.read())
helpers=ast.Module(body=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in ('norm','matches_metadata','discover_candidates')],type_ignores=[])
exec(compile(helpers,'worker','exec'))
recording={'title':'Butterflies','artists':['Gatsby Grace'],'durationSeconds':139.919}
correct={'id':'oV1uMjEw5qU','title':'Butterflies','channel':'Gatsby Grace - Topic','duration':140}
unrelated={'id':'Te11UaHOHMQ','title':'Young and Beautiful','channel':'Lana Del Rey','duration':236}
queries=[]
responses=[{'entries':[correct]}]
def yt(args):
    queries.append(args[-1]); return json.dumps(responses.pop(0))
assert discover_candidates(recording)==[correct]
assert len(queries)==1 and '"Gatsby Grace"' in queries[0] and '"Butterflies"' in queries[0]
queries.clear(); responses=[{'entries':[unrelated]},{'entries':[correct]}]
assert discover_candidates(recording)==[correct]
assert len(queries)==2
queries.clear(); responses=[{'entries':[unrelated]},{'entries':[unrelated]}]
assert discover_candidates(recording)==[]
assert len(queries)==2
`;
  const result = spawnSync("python3", ["-c", script], {
    input: verifiedAudioWorker,
    encoding: "utf8",
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});
