import { NextRequest } from "next/server";
import { guestContextHandler } from "@/lib/context/guest/guestContextHandler";
export async function POST(request: NextRequest) {
  return guestContextHandler(request);
}
export async function GET(request: NextRequest) {
  return guestContextHandler(request);
}
