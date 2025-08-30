import { NextRequest } from "next/server";
import { proxyJsonPost } from "@/lib/proxy";

export async function POST(req: NextRequest) {
  return proxyJsonPost(req, "/v1/otp/verify");
}


