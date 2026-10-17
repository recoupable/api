import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const eslint = new ESLint();

describe("task-run transport imports", () => {
  it.each([
    ["app/api/tasks/runs/route.ts", "@/lib/trigger/retrieveTaskRun"],
    ["lib/tasks/getTaskRunHandler.ts", "../trigger/retrieveTaskRun"],
    ["lib/mcp/tools/tasks/registerGetTaskRunStatusTool.ts", "@/lib/trigger/retrieveTaskRun"],
    ["lib/mcp/oauth/executeFullOAuthTool.ts", "../../trigger/retrieveTaskRun"],
  ])("rejects raw retrieval in %s", async (filePath, source) => {
    const [result] = await eslint.lintText(`import { retrieveTaskRun } from "${source}";\n`, {
      filePath,
    });
    expect(
      result.messages.filter(message => message.ruleId === "no-restricted-imports"),
    ).toHaveLength(1);
  });

  it.each([
    "lib/tasks/readTaskRunForAccount.ts",
    "lib/tasks/getTaskTriggerInfo.ts",
    "lib/chat/runs/linkTriggerRunToWorkflow.ts",
    "lib/tasks/__tests__/getTaskRunHandler.test.ts",
  ])(
    "keeps provider adapters, classified internal operations, and tests available in %s",
    async filePath => {
      const [result] = await eslint.lintText(
        'import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";\n',
        { filePath },
      );
      expect(result.messages.filter(message => message.ruleId === "no-restricted-imports")).toEqual(
        [],
      );
    },
  );
});
