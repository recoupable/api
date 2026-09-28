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
