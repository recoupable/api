import { readJson } from "../pack-scheduler-workflow-fixture/readJson.mjs";
import { join } from "node:path";
import { readFile, readdir } from "node:fs/promises";
/** Capture is bounded and best-effort; it must never replace the original failure. */
export async function captureAdmissionFailure(child, effects, error) {
  const evidence = { error: { name: error.name, message: error.message } };
  try {
    evidence.saved = await readJson(join(effects, "assertion-evidence.json"));
  } catch (captureError) {
    evidence.savedUnavailable = captureError.message;
  }
  if (child?.connected && child.exitCode === null && child.signalCode === null) {
    evidence.live = await new Promise(resolve => {
      const requestId = "failure-snapshot";
      const finish = value => {
        clearTimeout(timer);
        child.off("message", onMessage);
        resolve(value);
      };
      const onMessage = message => {
        if (message?.type === "admission-snapshot" && message.requestId === requestId)
          finish(message.evidence);
      };
      const timer = setTimeout(
        () => finish({ unavailable: "snapshot timed out after 1000ms" }),
        1000,
      );
      child.on("message", onMessage);
      try {
        child.send({ type: "admission-snapshot", requestId }, sendError => {
          if (sendError) finish({ unavailable: sendError.message });
        });
      } catch (sendError) {
        finish({ unavailable: sendError.message });
      }
    });
  }
  for (const name of ["before-crash.json", "before-crash-world-trace.json", "start-clock.json"]) {
    try {
      evidence[name] = await readJson(join(effects, name));
    } catch (captureError) {
      evidence[name] = { unavailable: captureError.message };
    }
  }
  for (const phase of ["start", "resume"]) {
    try {
      evidence[`${phase}OperationTrace`] = (
        await readFile(join(effects, `${phase}-world-trace.jsonl`), "utf8")
      )
        .split("\n")
        .filter(Boolean)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { incompleteRawLine: line };
          }
        });
    } catch (captureError) {
      evidence[`${phase}OperationTrace`] = { unavailable: captureError.message };
    }
  }
  for (const kind of ["events", "waits"]) {
    try {
      const directory = join(effects, "journal", kind);
      const names = (await readdir(directory)).filter(name => name.endsWith(".json")).sort();
      evidence[`raw${kind}`] = {
        truncated: names.length > 2048,
        files: await Promise.all(
          names.slice(0, 2048).map(async name => {
            try {
              return { name, data: await readJson(join(directory, name)) };
            } catch (readError) {
              return { name, unavailable: readError.message };
            }
          }),
        ),
      };
    } catch (captureError) {
      evidence[`raw${kind}`] = { unavailable: captureError.message };
    }
  }
  console.error("PACK_ADMISSION_SAVED_FAILURE", JSON.stringify(evidence, null, 2));
  return evidence;
}
