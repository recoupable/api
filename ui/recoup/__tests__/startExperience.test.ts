import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startExperience } from "../startExperience";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function elements() {
  const status = { textContent: "", classList: { add: vi.fn(), remove: vi.fn() } };
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
  expect(status.textContent).toBe("Sent to chat.");
  vi.advanceTimersByTime(3000);
  expect(status.textContent).toBe("");
  expect(status.classList.remove).toHaveBeenCalledWith("handoff-active");
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
  vi.advanceTimersByTime(5000);
  expect(status.textContent).toContain("try again");
  await open("cover");
  expect(status.textContent).toBe("Sent to chat.");
});

it("does not let an earlier confirmation clear the next request's feedback", async () => {
  const { status, start } = elements();
  let finish!: (result: { isError?: boolean }) => void;
  const send = vi
    .fn()
    .mockResolvedValueOnce({})
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
  const open = start(send);
  await open("cover");
  vi.advanceTimersByTime(2000);
  const next = open("film");
  vi.advanceTimersByTime(2000);
  expect(status.textContent).toContain("Starting");
  expect(status.classList.remove).not.toHaveBeenCalled();
  finish({});
  await next;
  expect(status.textContent).toBe("Sent to chat.");
});
it.each([
  ["add-release", "recoup-release-add-release"],
  ["check-release-metadata", "recoup-release-check-metadata"],
  ["import-catalog", "recoup-catalog-import-catalog"],
  ["check-song-credits", "recoup-song-check-credits"],
  ["explain-music-contract", "recoup-catalog-explain-contract"],
  ["organize-publishing", "recoup-catalog-organize-publishing"],
])("hands %s to its corresponding skill", async (id, skill) => {
  const { start } = elements();
  const send = vi.fn().mockResolvedValue({});
  await start(send)(id);
  expect(send).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledWith(expect.stringContaining(skill));
});
