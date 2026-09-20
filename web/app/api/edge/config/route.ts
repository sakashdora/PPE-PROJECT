import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

/**
 * INTEGRATION FIX (CRITICAL): The previous static config had:
 *   server_url: "http://localhost:3000"   <-- WRONG: would loop back to Next.js!
 *
 * The edge worker must target NestJS on port 4000 for heartbeat, alerts, and config.
 * This route now proxies from NestJS so config is authoritative and live-updateable.
 *
 * If NestJS is unreachable, we return a safe static fallback with the CORRECT server_url.
 */
const NESTJS_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const EDGE_API_KEY =
  process.env.EDGE_API_KEY || "edge-api-key-factory-plant-01";

const FALLBACK_CONFIG = {
  configVersion: 1,
  node_id: "edge-node-01",
  server_url: "http://localhost:4000", // CORRECT: NestJS, not Next.js
  heartbeat_interval_sec: 5,
  cooldown_seconds: 60,
  mjpeg_port: 8080,
  model_path: "models/best.onnx",
  cameras: [
    {
      id: "cam-01",
      name: "Main Workshop - Assembly Line A",
      sector: "Sector 1",
      source: "synthetic",
      fps_target: 10,
      zones: [
        {
          id: "z-assembly-01",
          name: "Active Crane Zone",
          type: "mandatory_ppe",
          polygon: [
            [0.1, 0.1],
            [0.9, 0.1],
            [0.9, 0.9],
            [0.1, 0.9],
          ],
          required_ppe: ["helmet", "vest", "boots"],
          severity: "COMPLIANCE",
        },
      ],
    },
    {
      id: "cam-02",
      name: "Chemical & Boiler Room B",
      sector: "Sector 2",
      source: "synthetic",
      fps_target: 10,
      zones: [
        {
          id: "z-boiler-flame",
          name: "Flammable Gas Storage",
          type: "smoking_restricted",
          polygon: [
            [0.15, 0.2],
            [0.85, 0.2],
            [0.85, 0.85],
            [0.15, 0.85],
          ],
          required_ppe: ["helmet", "vest", "gloves", "boots"],
          severity: "WARNING",
        },
      ],
    },
  ],
  thresholds: {
    person: 0.5,
    helmet: 0.7,
    head: 0.65,
    vest: 0.65,
    gloves: 0.6,
    boots: 0.6,
    no_gloves: 0.6,
    no_boots: 0.6,
    fire: 0.35,
    smoke: 0.3,
    cigarette: 0.5,
  },
  voter: {
    fire_window: 5,
    fire_threshold: 2,
    smoke_window: 5,
    smoke_threshold: 2,
    smoking_window: 8,
    smoking_threshold: 4,
    ppe_window: 10,
    ppe_threshold: 8,
  },
};

export async function GET(req: NextRequest) {
  const ifNoneMatch = req.headers.get("if-none-match") || undefined;

  try {
    // Proxy to NestJS /edge/config with the edge API key
    const response = await fetch(`${NESTJS_URL}/edge/config`, {
      headers: {
        "X-Edge-Api-Key": EDGE_API_KEY,
        ...(ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {}),
      },
      cache: "no-store",
    });

    if (response.status === 304) {
      return new NextResponse(null, { status: 304 });
    }

    const data = await response.json();
    // Ensure server_url is always correct in forwarded config
    const enriched = { ...data, server_url: "http://localhost:4000" };
    const etag = response.headers.get("etag");
    const headers: Record<string, string> = {};
    if (etag) headers["ETag"] = etag;

    return NextResponse.json(enriched, { headers });
  } catch (error: any) {
    console.error("[CONFIG PROXY] NestJS unreachable, returning fallback config:", error.message);
    return NextResponse.json(FALLBACK_CONFIG);
  }
}
