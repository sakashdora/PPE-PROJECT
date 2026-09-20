import { NextRequest, NextResponse } from "next/server";

/**
 * INTEGRATION FIX: This route is a passthrough proxy for edge worker fallback.
 * The edge outbox.py tries both http://localhost:4000/edge/alerts (primary)
 * and http://localhost:3000/api/edge/alerts (fallback) when the NestJS server
 * is unreachable. This proxy ensures the fallback also reaches NestJS.
 *
 * In production, the edge worker always targets NestJS directly. This is only
 * a development convenience fallback.
 */
const NESTJS_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const apiKey = req.headers.get("x-edge-api-key") || "";

    let response: Response;

    if (contentType.includes("multipart/form-data")) {
      // Forward multipart (with snapshot) directly
      const body = await req.arrayBuffer();
      response = await fetch(`${NESTJS_URL}/edge/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "X-Edge-Api-Key": apiKey,
        },
        body,
      });
    } else {
      // JSON payload
      const payload = await req.json();
      response = await fetch(`${NESTJS_URL}/edge/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Edge-Api-Key": apiKey,
        },
        body: JSON.stringify(payload),
      });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("[EDGE PROXY] Failed to forward alert to NestJS:", error.message);
    return NextResponse.json(
      { error: "Failed to reach on-prem server", detail: error.message },
      { status: 503 }
    );
  }
}

export async function GET() {
  // Healthcheck probe: verify the NestJS server is reachable
  try {
    const response = await fetch(`${NESTJS_URL}/health/live`, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json({ proxy: "ok", nestjs: data });
  } catch (error: any) {
    return NextResponse.json({ proxy: "ok", nestjs: "unreachable", error: error.message }, { status: 200 });
  }
}
