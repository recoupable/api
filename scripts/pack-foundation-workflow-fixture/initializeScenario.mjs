import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
export async function initializeScenario(temp, effects, scenario) {
  const { initialize } = await import(pathToFileURL(join(temp, "generated/initialize.cjs")));
  const state = await initialize(scenario);
  await mkdir(effects);
  await writeFile(join(effects, "events.jsonl"), "");
  for (const name of ["initial.json", "state.json"])
    await writeFile(join(effects, name), JSON.stringify(state));
}
