import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function proxy(req: NextRequest, { params }: {
    params: Promise<{
        path: string[];
    }>;
}) {
    const { path } = await params;
    if (!path.length || !["auth", "alerts", "config", "reports", "health"].includes(path[0]) || path.some(p => p === ".." || p.includes("/")))
        return NextResponse.json({ message: "Unknown API route" }, { status: 404 });
    const upstream = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const headers = new Headers();
    for (const key of ["cookie", "authorization", "content-type"])
        if (req.headers.has(key))
            headers.set(key, req.headers.get(key)!);
    try {
        const response = await fetch(upstream + "/" + path.map(encodeURIComponent).join("/") + req.nextUrl.search, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(), cache: "no-store", signal: AbortSignal.timeout(15000) });
        const result = new NextResponse(response.body, { status: response.status });
        for (const key of ["content-type", "content-disposition", "cache-control"])
            if (response.headers.has(key))
                result.headers.set(key, response.headers.get(key)!);
        for (const cookie of response.headers.getSetCookie())
            result.headers.append("set-cookie", cookie);
        return result;
    }
    catch {
        return NextResponse.json({ message: "The safety server is unavailable. Check the connection and try again." }, { status: 503 });
    }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
