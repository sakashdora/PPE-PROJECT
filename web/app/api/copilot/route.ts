import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
    const server = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const headers = { cookie: req.headers.get("cookie") || "" };
    try {
        const auth = await fetch(server + "/auth/me", { headers, cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!auth.ok)
            return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
        const body = await req.json();
        if (typeof body.question !== "string" || body.question.length > 1000)
            return NextResponse.json({ message: "Enter a question of at most 1000 characters." }, { status: 400 });
        const response = await fetch(server + "/reports/overview", { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok)
            throw Error();
        const data = await response.json();
        const open = data.alerts.filter((a: any) => a.status === "open");
        const ack = data.alerts.filter((a: any) => a.status === "acknowledged");
        const lines = ["Workspace summary · " + new Date(data.serverTime).toLocaleString(), "", open.length + " open incidents; " + ack.length + " acknowledged incidents awaiting resolution.", data.cameras.filter((c: any) => c.status === "online").length + " of " + data.cameras.filter((c: any) => c.enabled).length + " enabled cameras report fresh frames.", "", ...open.slice(0, 15).map((a: any) => a.severity + " · " + a.type.replaceAll("_", " ") + " · " + a.cameraName + " · " + a.items.join(", ")), "", ...data.nodes.map((n: any) => n.name + ": " + n.status + "; detector " + n.detectorMode + "; applied configuration v" + n.appliedConfigVersion), "", "This summary uses recorded workspace data. Inspect incident evidence and follow the supervisor response procedure."];
        return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    catch {
        return NextResponse.json({ message: "Workspace records are unavailable. Check the server connection." }, { status: 503 });
    }
}
