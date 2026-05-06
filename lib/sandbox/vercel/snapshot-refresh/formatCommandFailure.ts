import type { ExecResult } from "../../interface";
import { formatCommandOutput } from "./formatCommandOutput";

export function formatCommandFailure(command: string, result: ExecResult): string {
  const sections = [
    `Command failed while preparing base snapshot: ${command}`,
    result.exitCode === null ? null : `Exit code: ${result.exitCode}`,
    formatCommandOutput("stdout", result.stdout),
    formatCommandOutput("stderr", result.stderr),
    result.truncated ? "Output was truncated." : null,
  ].filter((section): section is string => section !== null);

  return sections.join("\n\n");
}
