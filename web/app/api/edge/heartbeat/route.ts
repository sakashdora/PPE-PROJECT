import { NextRequest, NextResponse } from "next/server";

/**
 * INTEGRATION FIX: Proxies heartbeat to NestJS so the real clearAlarms/configVersion
 * response flows back to the edge worker. Previously this was an in-memory stub that
 * returned { recorded: true } — breaking the physical alarm unlatch protocol.
 *
 * The edge HeartbeatClient calls POST /edge/heartbeat and expects:
 *   { ok: true, configVersion: number, clearAlarms: string[] }
 *
 * If NestJS is unreachable, we return a safe default so the edge does NOT unlatch
 * alarms (fail-closed for safety).
 */
const NESTJS_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const apiKey = req.headers.get("x-edge-api-key") || "";

    const response = await fetch(`${NESTJS_URL}/edge/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Edge-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("[HEARTBEAT PROXY] NestJS unreachable:", error.message);
    // Fail-closed: return empty clearAlarms so edge does NOT unlatch physical alarms
    // when the server is down (safety-critical default).
    return NextResponse.json({
      ok: false,
      configVersion: 1,
      clearAlarms: [],
      error: "on-prem-server-unreachable",
    });
  }
}

export async function GET() {
  // Return current edge node status by querying NestJS health
  try {
    const response = await fetch(`${NESTJS_URL}/health/ready`, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json({ proxy: "ok", server: data });
  } catch {
    return NextResponse.json({ proxy: "ok", server: "unreachable" });
  }
}
