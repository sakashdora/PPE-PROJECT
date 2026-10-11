"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Camera as CameraIcon, Check, Edit3, Plus, RefreshCw, Save, Settings2, Trash2, X } from "lucide-react";
import { api, Camera, Zone, age, useOperations } from "@/lib/operations";
import { Badge, Empty, PageHeader } from "./Overview";
function Permission() { return <div className="admin-note"><Settings2 size={16}/>Administrator access is required to change detection configuration.</div>; }
export function CameraAdmin() {
    const ops = useOperations();
    const canEdit = ops.user?.role === "ADMIN";
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [editing, setEditing] = useState<Camera | null | undefined>(undefined);
    const [pending, setPending] = useState(false);
    const [form, setForm] = useState({ name: "", source: "", sectorId: "", edgeNodeId: "" });
    const load = async () => { try {
        setCameras(await api<Camera[]>("/config/cameras"));
    }
    catch (e) {
        setError((e as Error).message);
    } };
    useEffect(() => { void load(); }, [ops.data.config.version]);
    const open = (camera: Camera | null) => { setEditing(camera); setForm({ name: camera?.name || "", source: camera?.source || "", sectorId: camera?.sectorId || ops.data.sectors[0]?.id || "", edgeNodeId: camera?.edgeNodeId || ops.data.nodes[0]?.id || "" }); setError(""); };
    const save = async (e: FormEvent) => { e.preventDefault(); setPending(true); setError(""); try {
        await api(editing ? "/config/cameras/" + encodeURIComponent(editing.id) : "/config/cameras", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
        setEditing(undefined);
        setSuccess("Camera saved. The edge will apply it on its next configuration sync.");
        await load();
        await ops.refresh();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setPending(false);
    } };
    const toggle = async (camera: Camera) => { setError(""); try {
        await api("/config/cameras/" + encodeURIComponent(camera.id), { method: "PATCH", body: JSON.stringify({ enabled: !camera.enabled }) });
        await load();
        await ops.refresh();
    }
    catch (e) {
        setError((e as Error).message);
    } };
    return <><PageHeader title="Cameras & zones" description="Manage camera sources, availability and detection boundaries."><button className="button" onClick={() => void load()}><RefreshCw size={15}/>Refresh</button>{canEdit && <button className="button primary" onClick={() => open(null)}><Plus size={16}/>Add camera</button>}</PageHeader>{!canEdit && <Permission />}{error && editing === undefined && <div className="error-box" role="alert">{error}</div>}{success && <div className="success-box" role="status">{success}</div>}<div className="camera-admin-grid">{cameras.map(c => <section className="panel camera-admin-card" key={c.id}><div className="camera-admin-head"><div><h2>{c.name}</h2><p>{c.id} · {c.sector}</p></div><Badge kind={c.status}/></div><div className="data-list"><div><span>Edge node</span><strong>{c.edgeNodeName || c.edgeNodeId}</strong></div><div><span>Last frame</span><strong>{age(c.lastFrameAt)}</strong></div><div><span>Detection zones</span><strong>{c.zones.length}</strong></div>{canEdit && <div><span>Source</span><strong className="camera-source" title={c.source}>{c.source || "Not configured"}</strong></div>}</div><div className="camera-admin-actions"><Link className="button small" href={"/admin/zones/" + encodeURIComponent(c.id)}>Edit zones</Link>{canEdit && <><button className="button small" onClick={() => open(c)}><Edit3 size={13}/>Edit camera</button><button className="text-button" onClick={() => void toggle(c)}>{c.enabled ? "Disable" : "Enable"}</button></>}</div></section>)}</div>{!cameras.length && <section className="panel"><Empty title="No cameras configured" description="Add a camera and assign it to an existing edge node."/></section>}
  {editing !== undefined && <div className="modal-shade" onClick={() => !pending && setEditing(undefined)}><form className="form-modal" onSubmit={save} onClick={e => e.stopPropagation()}><h2>{editing ? "Edit camera" : "Add camera"}</h2><div className="form-stack"><label>Camera name<input value={form.name} maxLength={120} onChange={e => setForm({ ...form, name: e.target.value })} required/></label><label>Camera source<input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} required placeholder="rtsp://camera-host/stream"/></label><p className="form-note">Use an RTSP URL or an edge-local video path. The source “synthetic” explicitly enables a demonstration feed.</p>{!editing && <><label>Sector<select value={form.sectorId} onChange={e => setForm({ ...form, sectorId: e.target.value })} required>{ops.data.sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Edge node<select value={form.edgeNodeId} onChange={e => setForm({ ...form, edgeNodeId: e.target.value })} required>{ops.data.nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label></>}{error && <div className="error-box" role="alert">{error}</div>}</div><div className="form-actions"><button type="button" className="button" disabled={pending} onClick={() => setEditing(undefined)}>Cancel</button><button className="button primary" disabled={pending}>{pending ? "Saving…" : "Save camera"}</button></div></form></div>}</>;
}
export function DetectionSettings() {
    const ops = useOperations();
    const admin = ops.user?.role === "ADMIN";
    const model = ops.data.models.find(m => m.active);
    const [thresholds, setThresholds] = useState<Record<string, number>>({});
    const [params, setParams] = useState<Record<string, number>>({});
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);
    const [modelId, setModelId] = useState("");
    useEffect(() => { setThresholds(model?.thresholds || {}); setModelId(model?.id || ""); setParams({ fire_window: 5, fire_threshold: 2, smoke_window: 5, smoke_threshold: 2, smoking_window: 8, smoking_threshold: 4, ppe_window: 10, ppe_threshold: 8, cooldown_seconds: 60, ...ops.data.config.params }); }, [model?.id, ops.data.config.version]);
    const save = async (e: FormEvent) => { e.preventDefault(); setError(""); setMessage(""); setPending(true); try {
        await api("/config/detection", { method: "PUT", body: JSON.stringify({ thresholds, params }) });
        await ops.refresh();
        setMessage("Settings saved. Check the applied version below to confirm edge synchronization.");
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setPending(false);
    } };
    const activate = async () => { setError(""); setPending(true); try {
        await api("/config/models/" + encodeURIComponent(modelId) + "/activate", { method: "POST" });
        await ops.refresh();
        setMessage("Model configuration updated. The edge validates and loads the selected artifact before reporting its applied version.");
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setPending(false);
    } };
    return <><PageHeader title="Detection settings" description="Configure confidence thresholds, temporal voting and model selection."/>{!admin && <Permission />}{error && <div className="error-box" role="alert">{error}</div>}{message && <div className="success-box" role="status">{message}</div>}<form onSubmit={save}><div className="settings-grid"><section className="panel"><div className="panel-heading"><h2>Confidence thresholds</h2></div><div className="panel-content"><p className="muted small-text">Lower values increase recall. Fire and smoke thresholds have a maximum of 0.85.</p><div className="threshold-grid">{["person", "helmet", "head", "vest", "gloves", "boots", "no_gloves", "no_boots", "fire", "smoke", "cigarette"].map(key => <label className="threshold-label" key={key}><span>{key.replaceAll("_", " ")}</span><input type="number" min=".05" max={["fire", "smoke"].includes(key) ? ".85" : ".99"} step=".01" value={thresholds[key] ?? .5} disabled={!admin || pending} onChange={e => setThresholds({ ...thresholds, [key]: Number(e.target.value) })}/></label>)}</div></div></section><section className="panel"><div className="panel-heading"><h2>Temporal confirmation</h2></div><div className="panel-content"><p className="muted small-text">Each rule requires a number of positive frames within the configured window.</p><div className="form-stack">{["fire", "smoke", "smoking", "ppe"].map(key => <div className="form-grid" key={key}><label>{key === "ppe" ? "PPE" : key} required votes<input type="number" min="1" max={params[key + "_window"]} value={params[key + "_threshold"] ?? 2} disabled={!admin || pending} onChange={e => setParams({ ...params, [key + "_threshold"]: Number(e.target.value) })}/></label><label>Window size<input type="number" min="1" max="60" value={params[key + "_window"] ?? 5} disabled={!admin || pending} onChange={e => setParams({ ...params, [key + "_window"]: Number(e.target.value) })}/></label></div>)}<label>Cooldown (seconds)<input type="number" min="1" max="3600" value={params.cooldown_seconds ?? 60} disabled={!admin || pending} onChange={e => setParams({ ...params, cooldown_seconds: Number(e.target.value) })}/></label></div></div></section></div>{admin && <div className="form-actions"><button className="button primary" disabled={pending || !ops.connected}><Save size={15}/>{pending ? "Saving…" : "Save detection settings"}</button></div>}</form><section className="panel" style={{ marginTop: 22 }}><div className="panel-heading"><h2>Model & configuration rollout</h2><Badge kind="acknowledged">Version {ops.data.config.version}</Badge></div><div className="panel-content"><div className="filter-bar" style={{ padding: 0, border: 0, marginBottom: 20 }}><label>Active model<select value={modelId} onChange={e => setModelId(e.target.value)} disabled={!admin || pending}>{ops.data.models.map(m => <option key={m.id} value={m.id}>{m.name}{m.active ? " · Active" : ""}</option>)}</select></label>{admin && <button className="button" onClick={() => void activate()} disabled={pending || modelId === model?.id || !modelId}>Activate model</button>}</div><div className="data-list">{ops.data.nodes.map(n => <div key={n.id}><span>{n.name}</span><strong>{n.appliedConfigVersion === ops.data.config.version ? "Applied · v" + n.appliedConfigVersion : "Awaiting sync · applied v" + n.appliedConfigVersion}</strong></div>)}</div></div></section></>;
}
export function ZoneEditor() {
    const params = useParams<{
        cameraId: string;
    }>();
    const ops = useOperations();
    const camera = ops.data.cameras.find(c => c.id === params.cameraId);
    const admin = ops.user?.role === "ADMIN";
    const [points, setPoints] = useState<number[][]>([]);
    const [name, setName] = useState("New detection zone");
    const [kind, setKind] = useState("PPE_REQUIRED");
    const [ppe, setPpe] = useState(["helmet", "vest"]);
    const [selected, setSelected] = useState<Zone | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);
    const reset = () => { setPoints([]); setSelected(null); setName("New detection zone"); setKind("PPE_REQUIRED"); setError(""); };
    const edit = (z: Zone) => { setSelected(z); setName(z.name); setKind(z.kind); setPpe(z.requiredPpe); setPoints(z.polygon); };
    const save = async (e: FormEvent) => { e.preventDefault(); setPending(true); setError(""); try {
        await api(selected ? "/config/zones/" + encodeURIComponent(selected.id) : "/config/zones", { method: selected ? "PUT" : "POST", body: JSON.stringify({ cameraId: params.cameraId, name, kind, polygon: points, requiredPpe: ppe }) });
        await ops.refresh();
        reset();
        setMessage("Zone saved. Its boundaries will apply after the edge confirms the new configuration version.");
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setPending(false);
    } };
    const remove = async (z: Zone) => { if (!confirm("Delete detection zone “" + z.name + "”?"))
        return; try {
        await api("/config/zones/" + encodeURIComponent(z.id), { method: "DELETE" });
        await ops.refresh();
        if (selected?.id === z.id)
            reset();
    }
    catch (e) {
        setError((e as Error).message);
    } };
    return <><PageHeader title={camera ? "Zones · " + camera.name : "Camera zones"} description="Click the preview to draw normalized detection boundaries."><Link className="button" href="/admin/cameras">Back to cameras</Link></PageHeader>{!admin && <Permission />}{error && <div className="error-box" role="alert">{error}</div>}{message && <div className="success-box" role="status">{message}</div>}<div className="zone-layout"><section className="panel"><div className="panel-heading"><h2>{camera?.name || "Camera preview"}</h2><Badge kind={camera?.status || "unknown"}/></div><svg viewBox="0 0 1000 625" className="zone-canvas" aria-label="Polygon drawing canvas" onClick={e => { if (!admin || pending)
        return; const box = e.currentTarget.getBoundingClientRect(); if (points.length < 32)
        setPoints([...points, [Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (e.clientY - box.top) / box.height))]]); }}><defs><pattern id="zone-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#39382f"/></pattern></defs><rect width="1000" height="625" fill="url(#zone-grid)"/>{camera?.status === "online" && <image href={camera.previewUrl + "?snapshot=1"} width="1000" height="625" preserveAspectRatio="none"/>}{camera?.zones.filter(z => z.id !== selected?.id).map(z => <polygon key={z.id} points={z.polygon.map(p => p[0] * 1000 + "," + p[1] * 625).join(" ")} fill="#53734833" stroke="#779260" strokeWidth="3"/>)}{points.length > 1 && <polygon points={points.map(p => p[0] * 1000 + "," + p[1] * 625).join(" ")} fill="#c6752b33" stroke="#e7a15b" strokeWidth="3"/>}{points.map((p, i) => <circle key={i} cx={p[0] * 1000} cy={p[1] * 625} r="7" fill="#ffc07d"/>)}</svg><div className="panel-content"><p className="muted small-text">{points.length} points · At least 3 points are required. Coordinates are relative to the full camera frame.</p><div className="form-actions"><button className="button" disabled={!points.length} onClick={() => setPoints(p => p.slice(0, -1))}>Undo point</button><button className="button" onClick={reset}>Clear drawing</button></div></div></section><section className="panel"><div className="panel-heading"><h2>{selected ? "Edit zone" : "New zone"}</h2></div><div className="panel-content"><form className="form-stack" onSubmit={save}><label>Zone name<input value={name} required disabled={!admin} onChange={e => setName(e.target.value)}/></label><label>Detection policy<select value={kind} disabled={!admin} onChange={e => setKind(e.target.value)}><option value="PPE_REQUIRED">PPE required</option><option value="SMOKING_RESTRICTED">Smoking restricted</option><option value="IGNORE">Ignore PPE in this zone</option></select></label>{kind !== "IGNORE" && <div><span className="small-text muted">Required PPE</span><div className="detection-tags">{["helmet", "vest", "gloves", "boots"].map(item => <label key={item} className="checkbox-row"><input type="checkbox" checked={ppe.includes(item)} disabled={!admin} onChange={e => setPpe(e.target.checked ? [...ppe, item] : ppe.filter(p => p !== item))}/>{item}</label>)}</div></div>}<button className="button primary" disabled={!admin || points.length < 3 || pending}>{pending ? "Saving…" : selected ? "Update zone" : "Save zone"}</button></form><div className="zone-list">{camera?.zones.map(z => <div className="zone-list-row" key={z.id}><span>{z.name}<small className="muted" style={{ display: "block" }}>{z.kind.replaceAll("_", " ")}</small></span><button className="icon-button" aria-label={"Edit " + z.name} onClick={() => edit(z)}><Edit3 size={15}/></button>{admin && <button className="icon-button" aria-label={"Delete " + z.name} onClick={() => void remove(z)}><Trash2 size={15}/></button>}</div>)}</div></div></section></div></>;
}
