"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Camera as CameraIcon, Check, ChevronRight, Download, Expand, Grid2X2, Lock, RefreshCw, ShieldCheck, Wifi, X } from "lucide-react";
import { Camera, Incident, useOperations, age, dateTime, incidentTitle } from "@/lib/operations";
export function Badge({ kind, children }: {
    kind: string;
    children?: React.ReactNode;
}) { return <span className={"badge " + kind.toLowerCase()}>{children || kind.replaceAll("_", " ")}</span>; }
export function PageHeader({ title, description, children }: {
    title: string;
    description: string;
    children?: React.ReactNode;
}) { return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{children}</div></div>; }
export function Empty({ title, description }: {
    title: string;
    description: string;
}) { return <div className="empty"><ShieldCheck size={34}/><strong>{title}</strong><p>{description}</p></div>; }
export function CameraTile({ camera, onSelect }: {
    camera: Camera;
    onSelect?: (id: string) => void;
}) {
    const { data, refresh } = useOperations();
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const incident = data.alerts.find(a => a.cameraId === camera.id && a.status === "open");
    const live = camera.enabled && camera.status === "online" && !failed;
    useEffect(() => { setFailed(false); }, [camera.status, camera.previewUrl]);
    useEffect(() => { if (!failed || camera.status !== "online")
        return; const timer = setTimeout(() => { setAttempt(n => n + 1); setFailed(false); }, 10000); return () => clearTimeout(timer); }, [failed, camera.status]);
    const retry = () => { setAttempt(n => n + 1); setFailed(false); void refresh(); };
    return <div ref={ref} className={"camera-tile " + (incident?.severity === "CRITICAL" ? "selected-critical" : "")} onDoubleClick={() => void ref.current?.requestFullscreen()}>
    {live ? <img className="camera-image" src={camera.previewUrl + "?attempt=" + attempt} onError={() => setFailed(true)} alt={camera.name + " current camera feed"}/> : <div className="camera-unavailable"><CameraIcon size={37}/><strong>{!camera.enabled ? "Disabled" : failed ? "Preview unavailable" : camera.status === "unknown" ? "Waiting for camera" : "Offline"}</strong><span>{camera.lastFrameAt ? "Last frame " + age(camera.lastFrameAt) : "No frames received"}</span><button className="button small" onClick={retry}><RefreshCw size={14}/>Retry connection</button></div>}
    <div className="camera-top"><Badge kind={live ? (camera.sourceType === "demonstration" ? "demonstration" : incident?.severity || "live") : "offline"}>{live ? (camera.sourceType === "demonstration" ? "DEMO" : incident?.severity === "CRITICAL" ? "CRITICAL" : "LIVE") : "OFFLINE"}</Badge><span>{live && camera.fps !== null ? camera.fps.toFixed(1) + " FPS" : camera.lastFrameAt ? age(camera.lastFrameAt) : "No signal"}</span></div>
    <div className="camera-bottom"><button onClick={() => onSelect?.(camera.id)} title="Inspect camera incidents">{camera.id.toUpperCase()}<span>·</span>{camera.name}</button><button className="icon-button" aria-label={"Expand " + camera.name} onClick={() => void ref.current?.requestFullscreen()}><Expand size={16}/></button></div>
  </div>;
}
export function IncidentWorkspace({ incident, onClose, onUpdated, onSelectRelated }: {
    incident: Incident | null;
    onClose?: () => void;
      onUpdated?: (incident: Incident) => void;
      onSelectRelated?: (id: string) => void;
}) {
    const ops = useOperations();
    const [note, setNote] = useState("");
    const [pending, setPending] = useState("");
    const [error, setError] = useState("");
    const [snapshotError, setSnapshotError] = useState(false);
    useEffect(() => { setNote(incident?.note || ""); setError(""); setSnapshotError(false); }, [incident?.id, incident?.note]);
    if (!incident)
        return <section className="panel incident-workspace"><div className="panel-heading"><h2>Incident workspace</h2></div><Empty title="Ready for review" description="Select an incident to inspect its evidence and coordinate a response."/></section>;
    const canAct = ops.user?.role !== "VIEWER";
    const open = incident.status === "open";
    const acknowledged = incident.status === "acknowledged";
    const closed = !open && !acknowledged;
    const action = async (kind: string) => { setPending(kind); setError(""); try {
        const updated = await ops.transition(incident, kind, note);
        onUpdated?.(updated);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setPending("");
    } };
    const related = ops.data.alerts.filter(a => a.status === "open" && a.id !== incident.id).slice(0, 2);
    return <section className="panel incident-workspace"><div className="panel-heading"><h2>Incident workspace</h2>{onClose && <button className="icon-button" onClick={onClose} aria-label="Close incident"><X size={17}/></button>}</div><div className="incident-body"><div className="incident-title"><h2>{incidentTitle(incident)}</h2><Badge kind={incident.severity}/></div><div className="incident-location">{incident.cameraId.toUpperCase()} · {incident.cameraName}<Badge kind={incident.status}/></div><div className="incident-meta"><span>Event ID <b title={incident.id}>{incident.id.length > 24 ? incident.id.slice(0, 19) + "…" : incident.id}</b></span><span>{dateTime(incident.ts)}</span></div><div className="evidence-layout"><div className="evidence-image">{incident.snapshotUrl && !snapshotError ? <img src={incident.snapshotUrl + "?v=" + incident.version} alt={"Evidence: " + incidentTitle(incident)} onError={() => setSnapshotError(true)}/> : <div className="snapshot-empty"><CameraIcon size={26}/><span>{snapshotError ? "Snapshot unavailable" : "No snapshot attached"}</span></div>}</div><dl className="evidence-details"><dt>Evidence details</dt><dd><span>Confidence</span><strong>{Math.round(incident.confidence * 100)}%</strong></dd><dd><span>Temporal confirmation</span><strong>{incident.votes || "Not recorded"}</strong></dd><dd><span>Detections</span><strong>{incident.hitCount}</strong></dd></dl></div>
    <ol className="workflow"><li className={open ? "current" : "complete"}><b>{open ? "1" : <Check size={12}/>}</b>Open</li><li className={acknowledged ? "current" : closed ? "complete" : ""}><b>2</b>Acknowledged</li><li className={closed ? "current" : ""}><b>3</b>{incident.status === "false_alarm" ? "False alarm" : "Resolved"}</li></ol>
    <label className="sr-only" htmlFor={"note-" + incident.id}>Supervisor note</label><textarea id={"note-" + incident.id} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} placeholder="Add a supervisor note…" disabled={closed || !canAct} rows={2}/>
    {error && <div className="error-box" role="alert">{error}</div>}
    <div className="incident-actions"><button className="button primary" disabled={!canAct || !open || !!pending || !ops.connected} onClick={() => void action("ack")}><Check size={16}/>{pending === "ack" ? "Acknowledging…" : "Acknowledge incident"}</button><button className="button" disabled={!canAct || !acknowledged || !!pending || !ops.connected} onClick={() => void action("resolve")}>{open ? <Lock size={14}/> : <ShieldCheck size={14}/>}Resolve</button></div>
    {acknowledged && canAct && <button className="text-button" disabled={!!pending || !ops.connected} onClick={() => void action("false_alarm")}>Mark as false alarm</button>}
    <p className="action-hint">{!canAct ? "Supervisor access is required to change incident status." : open ? "Acknowledge before resolving." : closed ? "Response recorded in incident history." : "Confirm the area is safe before resolving."}</p>
    {incident.severity === "CRITICAL" && <div className={"alarm-status " + (open ? "latched" : "")}><i className={open ? "dot critical" : "dot safe"}/><strong>{open ? "Acknowledgment required" : "Acknowledgment confirmed"}</strong><span>{open ? "Edge clear follows confirmed acknowledgment." : "Clear command is available to the edge heartbeat."}</span></div>}
    {incident.ackBy && <p className="muted small-text">Acknowledged by {incident.ackBy} · {dateTime(incident.ackAt)}</p>}
    <div className="related-heading"><strong>Related incidents ({related.length})</strong><Link href="/alerts">View all<ArrowRight size={14}/></Link></div>{related.map(a => <Link className="related-row" onClick={onSelectRelated ? e => { e.preventDefault(); onSelectRelated(a.id); } : undefined} href={"/alerts?incident=" + encodeURIComponent(a.id)} key={a.id}><AlertTriangle size={16}/><span>{incidentTitle(a)} · {a.cameraId.toUpperCase()}</span><Badge kind={a.severity}/></Link>)}
    </div></section>;
}
export function ActivityTable({ rows, onSelect }: {
    rows: Incident[];
    onSelect?: (a: Incident) => void;
}) {
    if (!rows.length)
        return <Empty title="No incidents recorded" description="Incoming incidents will appear here when connected cameras report detections."/>;
    return <div className="table-scroll"><table><thead><tr><th>Time</th><th>Incident</th><th>Camera</th><th>Severity</th><th>Status</th><th>Assigned to</th><th className="sr-only">Inspect</th></tr></thead><tbody>{rows.map(a => <tr key={a.id}><td className="mono">{dateTime(a.ts)}</td><td><button className="table-link" onClick={() => onSelect?.(a)}>{incidentTitle(a)}</button></td><td>{a.cameraId.toUpperCase()}</td><td><Badge kind={a.severity}/></td><td><Badge kind={a.status}/></td><td>{a.ackBy || "Unassigned"}</td><td><button className="icon-button" onClick={() => onSelect?.(a)} aria-label={"Inspect " + incidentTitle(a)}><ChevronRight size={16}/></button></td></tr>)}</tbody></table></div>;
}
export default function Overview({ wall = false }: {
    wall?: boolean;
}) {
    const ops = useOperations();
    const [selected, setSelected] = useState<string | null>(null);
    const [sector, setSector] = useState("all");
    const [expanded, setExpanded] = useState(false);
    const rank = { CRITICAL: 0, WARNING: 1, COMPLIANCE: 2 };
    const queue = ops.data.alerts.filter(a => a.status === "open" || a.status === "acknowledged").sort((a, b) => rank[a.severity] - rank[b.severity] || b.ts.localeCompare(a.ts));
    const alerts = queue.filter(a => (a.cameraId + " " + a.cameraName + " " + incidentTitle(a)).toLowerCase().includes(ops.search.toLowerCase()));
    const incident = [...ops.data.alerts, ...ops.data.recent].find(a => a.id === selected) || alerts[0] || null;
    const cameras = ops.data.cameras.filter(c => (sector === "all" || c.sector === sector) && (c.name + " " + c.id).toLowerCase().includes(ops.search.toLowerCase()));
    const online = ops.data.cameras.filter(c => c.enabled && c.status === "online").length;
    const enabled = ops.data.cameras.filter(c => c.enabled).length;
    const open = queue.filter(a => a.status === "open");
    const critical = open.filter(a => a.severity === "CRITICAL").length;
    const acknowledged = ops.data.totals?.acknowledged ?? queue.filter(a => a.status === "acknowledged").length;
    const openCount = ops.data.totals?.open ?? open.length;
    const criticalCount = ops.data.totals?.critical ?? critical;
    const complianceCount = ops.data.totals?.compliance ?? open.filter(a => a.severity === "COMPLIANCE").length;
    const edgeConnected = ops.data.nodes.some(n => n.status === "online");
    const inspectCamera = (id: string) => { const alert = queue.find(a => a.cameraId === id); if (alert)
        setSelected(alert.id); };
    return <><PageHeader title={wall ? "Live cameras" : "Safety overview"} description={wall ? "Monitor your camera feeds and inspect active incidents." : "Monitor hazards. Review evidence. Coordinate response."}><button className="button" onClick={() => void ops.refresh()}><RefreshCw size={15}/>Refresh</button>{ops.user?.role !== "VIEWER" && <a className="button primary" href="/api/backend/reports/compliance" download><Download size={16}/>Export report</a>}</PageHeader>
    <div className="summary-grid"><div className="summary-card"><span className="metric-icon"><CameraIcon /></span><div><span className="muted">Cameras available</span><strong>{online}<small> / {enabled}</small></strong><span className={online < enabled ? "warning-text" : "muted"}>{enabled ? enabled - online + " camera" + (enabled - online === 1 ? "" : "s") + " need attention" : "Add a camera to begin"}</span><div className="availability-track"><i style={{ width: enabled ? online / enabled * 100 + "%" : "0%" }}/></div></div></div><div className="summary-card"><span className="metric-icon"><AlertTriangle /></span><div><span className="muted">Open incidents</span><strong>{openCount}</strong><div className="metric-badges"><Badge kind="critical">{criticalCount} Critical</Badge><Badge kind="compliance">{complianceCount} Compliance</Badge></div></div></div><div className="summary-card"><span className="metric-icon"><ShieldCheck /></span><div><span className="muted">Acknowledged</span><strong>{acknowledged}</strong><span className="muted">Awaiting resolution</span></div></div><div className="summary-card"><span className="metric-icon"><Wifi /></span><div><span className="muted">Edge connection</span><strong className="connection-value"><i className={edgeConnected ? "dot safe" : "dot critical"}/>{edgeConnected ? "Connected" : "Offline"}</strong><span className="muted">Last heartbeat: {age(ops.data.nodes[0]?.lastSeenAt)}</span></div></div></div>
    <div className={"operations-grid " + (expanded ? "wall-expanded" : "")}><div className="camera-stack"><section className="panel camera-wall"><div className="panel-heading"><h2>Live camera wall</h2><div className="panel-tools"><select aria-label="Filter cameras by sector" value={sector} onChange={e => setSector(e.target.value)}><option value="all">All sectors</option>{[...new Set(ops.data.cameras.map(c => c.sector))].map(s => <option key={s}>{s}</option>)}</select><span className="grid-indicator"><Grid2X2 size={16}/></span><button className="button small" onClick={() => setExpanded(x => !x)}><Expand size={15}/>{expanded ? "Restore layout" : "Expand wall"}</button></div></div>{cameras.length ? <div className="camera-grid">{cameras.map(c => <CameraTile camera={c} key={c.id} onSelect={inspectCamera}/>)}</div> : <Empty title="No cameras to show" description={ops.search ? "Try another search or sector." : "Configure cameras and connect an edge node to begin monitoring."}/>}</section><section className="panel activity-panel"><div className="panel-heading"><h2>Recent activity</h2><Link href="/history" className="text-link">View history<ArrowRight size={15}/></Link></div><ActivityTable rows={ops.data.recent.slice(0, wall ? 8 : 3)} onSelect={a => { setSelected(a.id); setExpanded(false); }}/></section></div>{!expanded && <IncidentWorkspace incident={incident}/>}</div>
  </>;
}
