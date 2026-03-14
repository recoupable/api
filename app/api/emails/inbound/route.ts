import type { NextRequest } from "next/server";
import { handleInboundEmail } from "@/lib/emails/inbound/handleInboundEmail";

export const POST = async (request: NextRequest) => {
  return handleInboundEmail(request);
};
