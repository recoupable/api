import { describe, it, expect } from "vitest";
import { getClaudeTaskToStart } from "@/lib/board/getClaudeTaskToStart";

const TRUSTED = ["vercel:user:trusted"];

const buildEvent = (overrides: Record<string, unknown> = {}, task: Record<string, unknown> = {}) =>
  ({
    cursor: "c1",
    type: "task.created",
    createdAt: "2026-11-20T00:00:00.000Z",
    payload: {},
    message: {
      id: "812",
      re: null,
      channel: "general",
      text: "what is today's date?",
      labels: { agent: "claude" },
      task: {
        state: "ready",
        owner: "vercel:user:trusted",
        by: "vercel:user:trusted",
        for: null,
        needs: [],
        epoch: 0,
        claim: null,
        blocked: null,
        result: null,
        reason: null,
        ...task,
      },
    },
    ...overrides,
  }) as never;

describe("getClaudeTaskToStart", () => {
  describe("starts Claude", () => {
    it.each(["task.created", "task.ready", "task.reopened"])(
      "for %s on a ready, unclaimed task from a trusted owner",
      type => {
        expect(getClaudeTaskToStart(buildEvent({ type }), TRUSTED)).toEqual({
          id: "812",
          channel: "general",
        });
      },
    );

    it("when agent=claude is set on an existing ready task", () => {
      const event = buildEvent({
        type: "labels.changed",
        payload: { set: { agent: "claude" }, unset: [] },
      });
      expect(getClaudeTaskToStart(event, TRUSTED)).toEqual({ id: "812", channel: "general" });
    });
  });

  describe("ignores the event", () => {
    it("when the owner is not trusted", () => {
      const event = buildEvent({}, { owner: "vercel:user:stranger" });
      expect(getClaudeTaskToStart(event, TRUSTED)).toBeNull();
    });

    it("when no owner is trusted", () => {
      expect(getClaudeTaskToStart(buildEvent(), [])).toBeNull();
    });

    it("for other event types", () => {
      for (const type of ["message.posted", "task.claimed", "task.completed", "reaction.added"]) {
        expect(getClaudeTaskToStart(buildEvent({ type }), TRUSTED)).toBeNull();
      }
    });

    it("for a label change that does not set agent=claude", () => {
      const event = buildEvent({
        type: "labels.changed",
        payload: { set: { state: "done" }, unset: [] },
      });
      expect(getClaudeTaskToStart(event, TRUSTED)).toBeNull();
    });

    it("when the thread no longer carries agent=claude", () => {
      const event = buildEvent();
      (event as { message: { labels: Record<string, string> } }).message.labels = {};
      expect(getClaudeTaskToStart(event, TRUSTED)).toBeNull();
    });

    it("for a reply rather than a root", () => {
      const event = buildEvent();
      (event as { message: { re: string | null } }).message.re = "800";
      expect(getClaudeTaskToStart(event, TRUSTED)).toBeNull();
    });

    it("when the message is not a task", () => {
      const event = buildEvent();
      delete (event as { message: { task?: unknown } }).message.task;
      expect(getClaudeTaskToStart(event, TRUSTED)).toBeNull();
    });

    it("when the task is not ready", () => {
      expect(getClaudeTaskToStart(buildEvent({}, { state: "waiting" }), TRUSTED)).toBeNull();
    });

    it("when the task is already claimed", () => {
      const event = buildEvent({}, { claim: { actor: "x", until: "2026-11-20T00:05:00.000Z" } });
      expect(getClaudeTaskToStart(event, TRUSTED)).toBeNull();
    });

    it("when the event has no message", () => {
      expect(getClaudeTaskToStart(buildEvent({ message: undefined }), TRUSTED)).toBeNull();
    });
  });
});
