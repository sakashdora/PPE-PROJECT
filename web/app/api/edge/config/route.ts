import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const key = req.headers.get("x-edge-api-key");
  if (!key) return NextResponse.json({ error: "Edge authentication required" }, { status: 401 });
  try {
    const headers: Record<string, string> = { "X-Edge-Api-Key": key };
    const etag = req.headers.get("if-none-match");
    if (etag) headers["If-None-Match"] = etag;
    const response = await fetch(`${process.env.INTERNAL_API_URL || "http://localhost:4000"}/edge/config`, { headers, cache: "no-store" });
    return new NextResponse(response.status === 304 ? null : await response.arrayBuffer(), {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json", ...(response.headers.get("etag") ? { ETag: response.headers.get("etag")! } : {}) },
    });
  } catch {
    return NextResponse.json({ error: "Configuration server unavailable" }, { status: 503 });
  }
}
