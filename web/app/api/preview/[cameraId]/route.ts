import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: {
    params: Promise<{
        cameraId: string;
    }>;
}) {
    const { cameraId } = await params;
    const api = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    try {
        const session = await fetch(api + "/auth/me", { headers: { cookie: req.headers.get("cookie") || "" }, cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!session.ok)
            return new NextResponse(null, { status: 401 });
        const edge = process.env.EDGE_STREAM_URL || "http://localhost:8080";
        const type = req.nextUrl.searchParams.get("snapshot") === "1" ? "snapshot" : "stream";
        const response = await fetch(edge + "/" + type + "/" + encodeURIComponent(cameraId), { cache: "no-store", signal: req.signal });
        return new NextResponse(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "image/jpeg", "cache-control": "no-store" } });
    }
    catch {
        return new NextResponse(null, { status: 503 });
    }
}
