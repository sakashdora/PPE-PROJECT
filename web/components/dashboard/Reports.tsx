"use client";
import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api, useOperations } from "@/lib/operations";
import { Empty, PageHeader } from "./Overview";
type Metrics = {
    total: number;
    open: number;
    acknowledged: number;
    resolved: number;
    false_alarm: number;
    severity: Record<string, number>;
    daily: {
        date: string;
        CRITICAL: number;
        WARNING: number;
        COMPLIANCE: number;
    }[];
    sectors: {
        name: string;
        count: number;
    }[];
    hasMore: boolean;
    analyzedCount: number;
};
export default function Reports() {
    const ops = useOperations();
    const [range, setRange] = useState("7");
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);
    const from = range === "all" ? "" : new Date(Date.now() - Number(range) * 86400000).toISOString();
    const query = from ? "?from=" + encodeURIComponent(from) : "";
    const load = async () => { setPending(true); setError(""); try {
        setMetrics(await api<Metrics>("/reports/aggregates" + query));
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setPending(false);
    } };
    useEffect(() => { void load(); }, [range]);
    return <><PageHeader title="Safety reports" description="Incident trends and response status from recorded factory events."><select value={range} aria-label="Report period" onChange={e => setRange(e.target.value)}><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All records</option></select><button className="button" disabled={pending} onClick={() => void load()}><RefreshCw size={15}/>Refresh</button>{ops.user?.role !== "VIEWER" && <a className="button primary" href={"/api/backend/reports/compliance" + query} download><Download size={15}/>Export CSV</a>}</PageHeader>{error && <div className="error-box" role="alert">{error}</div>}<div className="report-totals">{[["Total incidents", metrics?.total], ["Open", metrics?.open], ["Acknowledged", metrics?.acknowledged], ["Resolved", metrics?.resolved]].map(([label, value]) => <div className="report-total" key={label}><span className="muted">{label}</span><strong>{value ?? "—"}</strong></div>)}</div><div className="reports-grid"><section className="panel chart-panel"><h2>Incident volume</h2>{metrics?.daily.length ? <div style={{ height: 300 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.daily}><CartesianGrid stroke="#3a332a" vertical={false}/><XAxis dataKey="date" stroke="#a69c8c" fontSize={10} tickLine={false}/><YAxis stroke="#a69c8c" fontSize={10} allowDecimals={false} tickLine={false}/><Tooltip contentStyle={{ background: "#211d17", border: "1px solid #51483c", borderRadius: 6, fontSize: 12 }}/><Bar dataKey="CRITICAL" stackId="incidents" fill="#b64b42" name="Critical"/><Bar dataKey="WARNING" stackId="incidents" fill="#c6752b" name="Warning"/><Bar dataKey="COMPLIANCE" stackId="incidents" fill="#8b785b" name="Compliance" radius={[3, 3, 0, 0]}/></BarChart></ResponsiveContainer></div> : <Empty title="No events in this period" description="Choose another period to review earlier records."/>}</section><section className="panel chart-panel"><h2>Severity breakdown</h2>{["CRITICAL", "WARNING", "COMPLIANCE"].map(s => <div className="bar-row" key={s}><span>{s.charAt(0) + s.slice(1).toLowerCase()}</span><div className="bar-track"><i style={{ width: metrics?.total ? (metrics.severity[s] / metrics.total * 100) + "%" : "0%", background: s === "CRITICAL" ? "#b64b42" : s === "WARNING" ? "#c6752b" : "#8b785b" }}/></div><b>{metrics?.severity[s] ?? "—"}</b></div>)}<div className="data-list"><div><span>False alarms</span><strong>{metrics?.false_alarm ?? "—"}</strong></div><div><span>Chart records included</span><strong>{metrics?.analyzedCount ?? "—"}</strong></div></div><p className="form-note">These figures count recorded incidents. They do not represent the percentage of workers complying with PPE policy.</p></section></div><section className="panel" style={{ marginTop: 20 }}><div className="panel-heading"><h2>Incidents by sector</h2></div>{metrics?.sectors.length ? <table><thead><tr><th>Sector</th><th>Recorded incidents</th></tr></thead><tbody>{metrics.sectors.map(s => <tr key={s.name}><td>{s.name}</td><td>{s.count}</td></tr>)}</tbody></table> : <Empty title="No sector activity" description="Sector totals appear when incidents are recorded."/>}{metrics?.hasMore && <p className="panel-content muted">Charts include the most recent 10,000 records; summary totals include all matching incidents.</p>}</section></>;
}
