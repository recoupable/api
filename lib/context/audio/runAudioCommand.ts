import { execFile } from "node:child_process";
/** Worker-only adapter: no shell interpolation, inherited credentials or browser cookies. */
export async function runAudioCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: "utf8",
        timeout: 180_000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          LANG: "en_US.UTF-8",
          NODE_ENV: process.env.NODE_ENV ?? "production",
        },
      },
      (error, stdout) => {
        if (error)
          reject(
            new Error(
              `${command} failed (code ${error.code ?? "unknown"}, killed ${error.killed ?? false})`,
            ),
          );
        else resolve(stdout);
      },
    );
  });
}
