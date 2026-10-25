import { z } from "zod";

const epoch = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const runId = z
  .string()
  .min(1)
  .refine(value => !value.startsWith("pending-"));
const identity = z.object({ chatId: z.string().min(1), effectiveAccount: z.uuid() }).strict();
export const chatFenceIdentitySchema = identity;
export const chatFenceAuthoritySchema = identity
  .extend({ epoch: epoch.min(1), owner: z.uuid() })
  .strict();
export type ChatFenceAuthority = Readonly<z.infer<typeof chatFenceAuthoritySchema>>;
const token = { epoch: epoch.min(1), owner: z.uuid() };
const writer = { ...token, run_id: runId };
const retry = { request_id: z.uuid(), expected_epoch: epoch };
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const message = z
  .object({ id: z.string().min(1), role: z.enum(["user", "assistant"]), parts: z.array(z.json()) })
  .catchall(z.json());
const write = z
  .object({
    ...writer,
    id: z.string().min(1),
    role: z.enum(["user", "assistant"]),
    mode: z.enum(["insert", "upsert"]),
    parts: message,
  })
  .strict()
  .refine(
    p =>
      p.id === p.parts.id &&
      p.role === p.parts.role &&
      (p.mode !== "upsert" || p.role === "assistant"),
  );
const update = z
  .object({ ...writer, id: z.string().min(1), parts: message })
  .strict()
  .refine(p => p.id === p.parts.id);
export const chatFenceCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state"), payload: z.object({}).strict() }).strict(),
  z
    .object({
      action: z.literal("admit"),
      payload: z.object({ ...retry, input_hash: digest }).strict(),
    })
    .strict(),
  z.object({ action: z.literal("bind"), payload: z.object(writer).strict() }).strict(),
  z.object({ action: z.literal("write"), payload: write }).strict(),
  z.object({ action: z.literal("update_parts"), payload: update }).strict(),
  z
    .object({
      action: z.literal("release"),
      payload: z.union([
        z
          .object({ ...writer, reason: z.enum(["workflow_complete", "external_terminal"]) })
          .strict(),
        z.object({ ...token, reason: z.literal("confirmed_no_start") }).strict(),
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal("delete"),
      payload: z.object({ ...retry, anchor_id: z.string().min(1) }).strict(),
    })
    .strict(),
]);
export type ChatFenceCommand = z.infer<typeof chatFenceCommandSchema>;
const stateBase = { chat_id: z.string().min(1), epoch };
export const chatFenceReceiptSchemas = {
  state: z.discriminatedUnion("phase", [
    z
      .object({ ...stateBase, phase: z.literal("idle"), owner: z.null(), run_id: z.null() })
      .strict(),
    z
      .object({
        ...stateBase,
        epoch: epoch.min(1),
        phase: z.literal("pending"),
        owner: z.uuid(),
        run_id: z.null(),
      })
      .strict(),
    z
      .object({
        ...stateBase,
        epoch: epoch.min(1),
        phase: z.literal("running"),
        owner: z.uuid(),
        run_id: runId,
      })
      .strict(),
  ]),
  admit: z
    .object({
      chat_id: z.string().min(1),
      ...retry,
      input_hash: digest,
      epoch: epoch.min(1),
      bound_run_id: runId.nullable(),
      closed: z.boolean(),
    })
    .strict(),
  bind: z.object({ bound: z.literal(true) }).strict(),
  write: z
    .object({
      written: z.literal(true),
      outcome: z.enum(["inserted", "exactDuplicate", "updated"]),
    })
    .strict(),
  update_parts: z.object({ updated: z.boolean() }).strict(),
  release: z.object({ released: z.boolean() }).strict(),
  delete: z
    .object({
      epoch,
      deleted: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      request_id: z.uuid(),
    })
    .strict(),
};
export type ChatFenceSuccess = {
  [A in keyof typeof chatFenceReceiptSchemas]: {
    ok: true;
    action: A;
    value: z.infer<(typeof chatFenceReceiptSchemas)[A]>;
  };
}[keyof typeof chatFenceReceiptSchemas];
