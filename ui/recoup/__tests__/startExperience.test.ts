import { expect, it, vi } from "vitest";
import { startExperience } from "../startExperience";

function elements() {
  const status = { textContent: "", classList: { add: vi.fn() } };
  const cards = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
  return {
    status,
    cards,
    start: (send: (prompt: string) => Promise<{ isError?: boolean }>) =>
      startExperience(send, status as unknown as HTMLElement, cards as unknown as HTMLElement),
  };
}

it("hands the selection to chat without requiring a brief", async () => {
  const { status, start } = elements();
  const send = vi.fn().mockResolvedValue({});
  await start(send)("wave");
  expect(send).toHaveBeenCalledWith(expect.stringContaining("recoup-song-find-hook"));
  expect(status.textContent).toContain("sent");
});

it("prevents duplicate requests while a handoff is pending", async () => {
  const { start } = elements();
  let finish!: (result: { isError?: boolean }) => void;
  const send = vi.fn(
    () =>
      new Promise<{ isError?: boolean }>(resolve => {
        finish = resolve;
      }),
  );
  const open = start(send);
  const first = open("film");
  await open("film");
  expect(send).toHaveBeenCalledTimes(1);
  finish({});
  await first;
});

it("shows failure feedback and allows retry", async () => {
  const { status, cards, start } = elements();
  const send = vi.fn().mockResolvedValueOnce({ isError: true }).mockResolvedValue({});
  const open = start(send);
  await open("cover");
  expect(status.textContent).toContain("try again");
  expect(cards.removeAttribute).toHaveBeenCalledWith("aria-busy");
  await open("cover");
  expect(status.textContent).toContain("sent");
});
