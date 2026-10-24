import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { validateChatStreamLifecycleQuery } from "@/lib/chat/validateChatStreamLifecycleQuery";
import fixture from "../fixtures/published-docs.json";

const operations = Object.values(fixture.chatLifecycle);
const queries = [
  { name: "absent", query: "", optedIn: false },
  { name: "exact single", query: "?streamLifecycle=explicit-stop-v1", optedIn: true },
  { name: "unknown", query: "?streamLifecycle=future-version", optedIn: false },
  { name: "empty", query: "?streamLifecycle=", optedIn: false },
  { name: "case mismatch", query: "?streamLifecycle=Explicit-stop-v1", optedIn: false },
  {
    name: "repeated",
    query: "?streamLifecycle=explicit-stop-v1&streamLifecycle=explicit-stop-v1",
    optedIn: false,
  },
  {
    name: "mixed repeated",
    query: "?streamLifecycle=explicit-stop-v1&streamLifecycle=future-version",
    optedIn: false,
  },
];

it.each(operations)("declares the optional query policy on $method $path", operation => {
  const parameters = operation.parameters.filter(parameter => parameter.name === "streamLifecycle");
  expect(parameters).toHaveLength(1);
  const parameter = parameters[0];
  expect(parameter).toMatchObject({ in: "query", required: false, example: "explicit-stop-v1" });
  const validate = new Ajv().compile(parameter.schema);
  expect(validate("explicit-stop-v1")).toBe(true);
  expect(validate("future-version")).toBe(true);
  expect(validate(1)).toBe(false);
});

describe.each(operations)("published $method $path lifecycle query", operation => {
  it.each(queries)("retains the runtime policy for $name", ({ query, optedIn }) => {
    const request = new Request(`https://api.example${operation.path}${query}`, {
      method: operation.method,
    });
    expect(validateChatStreamLifecycleQuery(request)).toBe(optedIn);
  });
});

it("does not opt in from a POST body field", () => {
  const request = new Request("https://api.example/api/chat", {
    method: "POST",
    body: JSON.stringify({ streamLifecycle: "explicit-stop-v1" }),
  });
  expect(validateChatStreamLifecycleQuery(request)).toBe(false);
});
