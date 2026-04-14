import { ModelMessage } from "ai";
import { referenceReleaseReport } from "./referenceReleaseReport";

const getReleaseReportReferenceMessage = (): ModelMessage => {
  return {
    role: "user",
    content: [
      {
        type: "text" as const,
        text: `Here is an example release report for reference. Use this as a template for creating your own release reports / email text:

          ${referenceReleaseReport}`,
      },
    ],
  };
};

export default getReleaseReportReferenceMessage;
