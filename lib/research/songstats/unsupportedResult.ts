import type { ProxyResult } from "@/lib/research/ProxyResult";

export const UNSUPPORTED_RESULT: ProxyResult = {
  status: 501,
  data: { error: "Research data source does not support this endpoint" },
};
