"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Download, RefreshCw, Search } from "lucide-react";
import { api, Incident, incidentTitle, dateTime, useOperations } from "@/lib/operations";
import { ActivityTable, Badge, Empty, IncidentWorkspace, PageHeader } from "./Overview";
export function Triage() {
    const ops = useOperations();
    const [status, setStatus] = useState("active");
    const [severity, setSeverity] = useState("all");
    const [selected, setSelected] = useState<string | null>(null);
    const [visible, setVisible] = useState(20);
    const [older, setOlder] = useState<Incident[]>([]);
    const [loadError, setLoadError] = useState("");
    const [loadingMore, setLoadingMore] = useState(false);
    useEffect(() => { setSelected(new URLSearchParams(location.search).get("incident")); }, []);
    const rank = { CRITICAL: 0, WARNING: 1, COMPLIANCE: 2 };
    const combined = [...new Map([...older, ...ops.data.alerts].map(a => [a.id, a])).values()];
    const rows = combined.filter(a => (status === "active" ? ["open", "acknowledged"].includes(a.status) : a.status === status) && (severity === "all" || a.severity === severity) && [a.cameraId, a.cameraName, a.sector, incidentTitle(a)].join(" ").toLowerCase().includes(ops.search.toLowerCase())).sort((a, b) => rank[a.severity] - rank[b.severity] || b.ts.localeCompare(a.ts));
    const incident = combined.find(a => a.id === selected) || rows[0] || null;
    const more = async () => { if (visible < rows.length) {
        setVisible(n => n + 20);
        return;
    } const last = [...rows].sort((a, b) => b.ts.localeCompare(a.ts) || b.id.localeCompare(a.id)).at(-1); if (!last)
        return; setLoadingMore(true); setLoadError(""); try {
        const query = new URLSearchParams({ status: status === "active" ? "active" : status, limit: "50", cursor: last.id });
        if (severity !== "all")
            query.set("severity", severity);
        const result = await api<{
            items: Incident[];
            nextCursor: string | null;
        }>("/alerts?" + query);
        setOlder(old => [...old, ...result.items]);
        setVisible(n => n + 20);
    }
    catch (e) {
        setLoadError((e as Error).message);
    }
    finally {
        setLoadingMore(false);
    } };
    return <><PageHeader title="Alert triage" description="Review evidence, acknowledge incidents and record the response."><button className="button" onClick={() => void ops.refresh()}><RefreshCw size={15}/>Refresh queue</button></PageHeader><div className="triage-layout"><section className="panel"><div className="panel-heading"><h2>Incident queue <span className="muted">({rows.length})</span></h2><div className="panel-tools"><select aria-label="Incident status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active incidents</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option></select><select aria-label="Incident severity" value={severity} onChange={e => setSeverity(e.target.value)}><option value="all">All severities</option>{["CRITICAL", "WARNING", "COMPLIANCE"].map(s => <option key={s}>{s}</option>)}</select></div></div><div className="queue-list">{rows.length ? rows.slice(0, visible).map(a => <button key={a.id} className={"queue-item " + (a.id === incident?.id ? "selected" : "")} onClick={() => setSelected(a.id)}><span className={"queue-severity " + a.severity.toLowerCase()}/><div><div className="queue-item-title"><strong>{incidentTitle(a)}</strong><Badge kind={a.status}/></div><p>{a.cameraId.toUpperCase()} · {a.cameraName}</p><div className="queue-item-meta"><Badge kind={a.severity}/><span>{dateTime(a.ts)}</span><span>{Math.round(a.confidence * 100)}% confidence</span></div></div></button>) : <Empty title="Queue is clear" description="There are no incidents matching these filters."/>}</div>{loadError && <div className="error-box" role="alert">{loadError}</div>}{(visible < rows.length || ops.data.truncatedActive) && <div className="load-more"><button className="button" disabled={loadingMore} onClick={() => void more()}>{loadingMore ? "Loading…" : "Load more incidents"}</button></div>}</section><IncidentWorkspace incident={incident} onSelectRelated={setSelected}/></div></>;
}
export function History() {
    const ops = useOperations();
    const [rows, setRows] = useState<Incident[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [status, setStatus] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const [selected, setSelected] = useState<Incident | null>(null);
    const load = async (more = false) => { setPending(true); setError(""); try {
        const query = new URLSearchParams({ limit: "50" });
        if (status)
            query.set("status", status);
        if (from)
            query.set("from", new Date(from + "T00:00:00+05:30").toISOString());
        if (to)
            query.set("to", new Date(to + "T23:59:59+05:30").toISOString());
        if (more && cursor)
            query.set("cursor", cursor);
        const result = await api<{
            items: Incident[];
            nextCursor: string | null;
        }>("/alerts?" + query);
        setRows(old => more ? [...old, ...result.items] : result.items);
        setCursor(result.nextCursor);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setPending(false);
    } };
    useEffect(() => { void load(); }, [status, from, to]);
    const filtered = rows.filter(a => [incidentTitle(a), a.cameraName, a.sector, a.note].join(" ").toLowerCase().includes(ops.search.toLowerCase()));
    const inspect = async (a: Incident) => { try {
        setSelected(await api<Incident>("/alerts/" + encodeURIComponent(a.id)));
    }
    catch (e) {
        setError((e as Error).message);
    } };
    const query = new URLSearchParams();
    if (status)
        query.set("status", status);
    if (from)
        query.set("from", new Date(from + "T00:00:00+05:30").toISOString());
    if (to)
        query.set("to", new Date(to + "T23:59:59+05:30").toISOString());
    return <><PageHeader title="Incident history" description="Search durable incident records and review recorded supervisor actions.">{ops.user?.role !== "VIEWER" && <a className="button primary" href={"/api/backend/reports/compliance?" + query} download><Download size={16}/>Export CSV</a>}</PageHeader><section className="panel"><div className="filter-bar"><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>To<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}/></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{["open", "acknowledged", "resolved", "false_alarm"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label><button className="button" disabled={pending} onClick={() => void load()}><RefreshCw size={15}/>Refresh</button></div>{error && <div className="error-box" role="alert">{error}</div>}<ActivityTable rows={filtered} onSelect={a => void inspect(a)}/>{cursor && <div className="load-more"><button className="button" disabled={pending} onClick={() => void load(true)}>{pending ? "Loading…" : "Load more incidents"}</button></div>}</section>{selected && <div className="modal-shade" onClick={() => setSelected(null)}><div className="incident-modal" onClick={e => e.stopPropagation()}><IncidentWorkspace incident={ops.data.alerts.find(a => a.id === selected.id) || selected} onClose={() => setSelected(null)} onUpdated={updated => { setSelected(updated); setRows(old => old.map(a => a.id === updated.id ? updated : a)); }}/></div></div>}</>;
}
