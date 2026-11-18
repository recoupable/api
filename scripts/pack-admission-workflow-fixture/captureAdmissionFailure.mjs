import { readAdmissionDiagnosticFile } from "./readAdmissionDiagnosticFile.mjs";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
/** Capture is bounded and best-effort; it must never replace the original failure. */
export async function captureAdmissionFailure(child, effects, error) {
  const evidence = { error: { name: error.name, message: error.message } };
  try {
    evidence.saved = await readAdmissionDiagnosticFile(join(effects, "assertion-evidence.json"));
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
      evidence[name] = await readAdmissionDiagnosticFile(join(effects, name));
    } catch (captureError) {
      evidence[name] = { unavailable: captureError.message };
    }
  }
  for (const phase of ["start", "resume"]) {
    try {
      evidence[`${phase}OperationTrace`] = await readAdmissionDiagnosticFile(
        join(effects, `${phase}-world-trace.jsonl`),
        "jsonl",
      );
    } catch (captureError) {
      evidence[`${phase}OperationTrace`] = { unavailable: captureError.message };
    }
  }
  for (const kind of ["events", "waits"]) {
    try {
      const directory = join(effects, "journal", kind);
      const names = (await readdir(directory)).filter(name => name.endsWith(".json")).sort();
      const files = [];
      let budget = 4194304;
      for (const name of names.slice(0, 2048)) {
        if (budget <= 0) break;
        try {
          const capture = await readAdmissionDiagnosticFile(
            join(directory, name),
            "json",
            Math.min(budget, 65536),
          );
          budget -= capture.bytesRead;
          files.push({ name, capture });
        } catch (readError) {
          files.push({ name, unavailable: readError.message });
        }
      }
      evidence[`raw${kind}`] = {
        truncated: files.length < names.length,
        byteLimit: 4194304,
        files,
      };
    } catch (captureError) {
      evidence[`raw${kind}`] = { unavailable: captureError.message };
    }
  }
  console.error("PACK_ADMISSION_SAVED_FAILURE", JSON.stringify(evidence, null, 2));
  return evidence;
}
