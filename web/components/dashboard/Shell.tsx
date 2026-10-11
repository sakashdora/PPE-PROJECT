"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, AlertTriangle, Bell, Camera, ChartNoAxesCombined, ChevronDown, History, House, LogOut, Menu, Search, Settings2, Shield, Video, Volume2, VolumeX, X } from "lucide-react";
import { OperationsProvider, useOperations, age } from "@/lib/operations";
const main = [["/overview", "Overview", House], ["/wall", "Live cameras", Camera], ["/alerts", "Alert triage", AlertTriangle], ["/forensics", "Video forensics", Video], ["/history", "Incident history", History], ["/reports", "Reports", ChartNoAxesCombined]] as const;
const admin = [["/admin/cameras", "Cameras & zones", Camera], ["/admin/thresholds", "Detection settings", Settings2], ["/health", "System health", Activity]] as const;
export function Brand() { return <span className="brand"><Shield size={34}/><span><strong>ARGUS AI</strong><small>FACTORY SAFETY</small></span></span>; }
function Frame({ children }: {
    children: React.ReactNode;
}) {
    const path = usePathname();
    const ops = useOperations();
    const [mobile, setMobile] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const critical = ops.data.alerts.filter(a => a.status === "open" && a.severity === "CRITICAL");
    if (ops.loading)
        return <div className="session-screen"><Brand /><span className="muted">Connecting to your safety workspace…</span></div>;
    if (!ops.user)
        return <div className="session-screen"><Brand /><p role="alert">{ops.error || "Checking your session…"}</p><button className="button primary" onClick={() => location.reload()}>Retry connection</button><Link href="/login">Return to sign in</Link></div>;
    const nav = (items: typeof main | typeof admin) => items.map(([url, label, Icon]) => <Link key={url} href={url} onClick={() => setMobile(false)} className={"nav-link " + (path === url || (url === "/admin/cameras" && path.startsWith("/admin/zones")) ? "active" : "")}><Icon size={19}/><span>{label}</span>{url === "/alerts" && (ops.data.totals?.open ?? (ops.data.totals?.open ?? ops.data.alerts.filter(a => a.status === "open").length)) > 0 && <b className="nav-count">{(ops.data.totals?.open ?? ops.data.alerts.filter(a => a.status === "open").length)}</b>}</Link>);
    return <div className="dashboard-shell">
    {mobile && <button className="mobile-shade" aria-label="Close navigation" onClick={() => setMobile(false)}/>}
    <aside className={"sidebar " + (mobile ? "visible" : "")}><Link href="/overview" className="brand-link"><Brand /></Link><button className="plant-switch" onClick={() => void ops.refresh()} title="Refresh plant data"><span><House size={17}/>Factory Plant 01</span><ChevronDown size={15}/></button><nav aria-label="Main navigation">{nav(main)}</nav><div className="nav-group">ADMINISTRATION</div><nav aria-label="Administration">{nav(admin)}</nav><div className="sidebar-bottom"><Link href="/profile" className="user-link"><span className="avatar">{ops.user.name.split(" ").map(x => x[0]).slice(0, 2).join("")}</span><span><strong>{ops.user.name}</strong><small>{ops.user.role === "ADMIN" ? "System administrator" : ops.user.role === "SUPERVISOR" ? "Shift supervisor" : "Safety operator"}</small></span></Link><Link href="/settings" className="icon-button" aria-label="Workspace settings"><Settings2 size={17}/></Link></div></aside>
    <section className="workspace"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={20}/></button><div className="breadcrumb"><Shield size={17}/><span>Factory Plant 01</span><span className="muted">/</span><strong>Operations</strong></div><div className="topbar-actions"><label className="global-search"><Search size={16}/><input value={ops.search} onChange={e => ops.setSearch(e.target.value)} placeholder="Search incidents or cameras" aria-label="Search incidents or cameras"/></label><button className="icon-button" onClick={ops.toggleSound} aria-label={ops.sound ? "Mute browser alarm" : "Enable browser alarm"} title={ops.sound ? "Mute browser alarm" : "Enable browser alarm"}>{ops.sound ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button><Link href="/alerts" className="notification" aria-label={"Alert triage, " + (ops.data.totals?.critical ?? critical.length) + " critical incidents"}><Bell size={19}/>{critical.length > 0 && <i />}</Link><span className={"mode-badge " + (!ops.connected ? "offline" : "")}>{ops.connected ? (ops.data.cameras.some(c => c.sourceType === "demonstration") ? "Demo sources · real inference" : "Operational data") : "Server disconnected"}</span></div></header>
    {ops.error && <div className="connection-notice" role="alert"><AlertTriangle size={16}/><span>{ops.error}</span><button onClick={() => void ops.refresh()}>Retry</button></div>}
    <main className="workspace-main">{children}</main><footer className="workspace-footer"><span><i className={ops.connected ? "dot safe" : "dot critical"}/>{ops.connected ? "Backend connected" : "Backend disconnected"}</span><span>Live updates: {ops.socketState}</span><span>Model {ops.data.models.find(m => m.active)?.name || "Not configured"}</span><span className="footer-sync">Last sync {ops.data.serverTime ? age(ops.data.serverTime) : "Never"}</span></footer></section>
  </div>;
}
export default function DashboardShell({ children }: {
    children: React.ReactNode;
}) { return <OperationsProvider><Frame>{children}</Frame></OperationsProvider>; }
