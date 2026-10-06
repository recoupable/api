import { connect } from "node:net";
import { expect, it } from "vitest";
import { startOAuthLab } from "../fixtures/startOAuthLab";

it("releases the listener when adapter initialization fails", async () => {
  let issuer: string;
  await expect(
    startOAuthLab(value => {
      issuer = value;
      throw new Error("synthetic adapter startup failure");
    }),
  ).rejects.toThrow("synthetic adapter startup failure");
  const open = await new Promise<boolean>((resolve, reject) => {
    const socket = connect(Number(new URL(issuer).port), "127.0.0.1");
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error("Connection probe timed out"));
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", error => {
      socket.destroy();
      if ((error as NodeJS.ErrnoException).code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
  });
  expect(open).toBe(false);
});
