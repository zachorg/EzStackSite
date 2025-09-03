import { NextRequest } from "next/server";
import { proxyGet, proxyPost } from "@/lib/functions-proxy";

export async function GET(req: NextRequest) {
  return proxyGet("/listApiKeys", req);
}

export async function POST(req: NextRequest) {
  return proxyPost("/createApiKey", req);
}

export async function DELETE(req: NextRequest) {
  return proxyPost("/revokeApiKey", req);
}

export async function PATCH(req: NextRequest) {
  return proxyPost("/setDefaultApiKey", req);
}


