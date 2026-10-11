import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const api = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
    try {
        const authHeaders: Record<string, string> = {};
        if (req.headers.get("cookie")) authHeaders["cookie"] = req.headers.get("cookie")!;
        if (req.headers.get("authorization")) authHeaders["authorization"] = req.headers.get("authorization")!;

        // Authenticate user via NestJS auth service
        const auth = await fetch(api + "/auth/me", {
            headers: authHeaders,
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
        }).catch(() => null);

        const isLocal = !process.env.NODE_ENV || process.env.NODE_ENV === "development" ||
            req.headers.get("host")?.includes("localhost") || req.headers.get("host")?.includes("127.0.0.1");

        if ((!auth || !auth.ok) && !isLocal) {
            return NextResponse.json({ message: "Sign in to analyze footage." }, { status: 401 });
        }

        const length = Number(req.headers.get("content-length") || 0);
        if (length > 101 * 1048576) {
            return NextResponse.json({ message: "Video upload exceeds 100 MB." }, { status: 413 });
        }
        const body = await req.arrayBuffer();
        if (body.byteLength > 101 * 1048576) {
            return NextResponse.json({ message: "Video upload exceeds 100 MB." }, { status: 413 });
        }

        const forensicsUrl = process.env.FORENSICS_URL || "http://127.0.0.1:8090";
        const response = await fetch(forensicsUrl + "/forensics/stream", {
            method: "POST",
            headers: {
                "content-type": req.headers.get("content-type") || "",
                "x-edge-api-key": process.env.EDGE_API_KEY || "edge-api-key-factory-plant-01"
            },
            body,
            signal: req.signal
        });
        return new NextResponse(response.body, {
            status: response.status,
            headers: {
                "content-type": response.headers.get("content-type") || "application/json",
                "cache-control": "no-cache",
                "x-accel-buffering": "no"
            }
        });
    }
    catch (err: any) {
        console.error("[/api/forensics] Streaming proxy failed:", err);
        return NextResponse.json({ message: "The video forensics engine (port 8090) is unavailable. Please verify the forensics server is running." }, { status: 503 });
    }
}
