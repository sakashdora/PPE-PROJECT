"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { audioController } from "./audio";
export type User = {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "SUPERVISOR" | "VIEWER";
};
export type Incident = {
    id: string;
    cameraId: string;
    cameraName: string;
    sector: string;
    ts: string;
    updatedAt: string;
    severity: "CRITICAL" | "WARNING" | "COMPLIANCE";
    type: string;
    items: string[];
    confidence: number;
    votes: string;
    hitCount: number;
    status: "open" | "acknowledged" | "resolved" | "false_alarm";
    version: number;
    snapshotUrl: string | null;
    modelVersion: string | null;
    note: string;
    ackBy?: string;
    ackAt?: string;
    resolvedAt?: string;
    bbox?: number[];
};
export type Zone = {
    id: string;
    cameraId: string;
    name: string;
    kind: string;
    polygon: number[][];
    requiredPpe: string[];
};
export type Camera = {
    id: string;
    name: string;
    sector: string;
    sectorId: string;
    edgeNodeId: string;
    edgeNodeName?: string;
    enabled: boolean;
    status: string;
    fps: number | null;
    latencyMs: number | null;
    lastFrameAt: string | null;
    frameAgeMs: number | null;
    sourceType: string;
    source?: string;
    previewUrl: string;
    zones: Zone[];
};
export type EdgeNode = {
    id: string;
    name: string;
    status: string;
    lastSeenAt: string | null;
    fps: number | null;
    latencyMs: number | null;
    detectorMode: string;
    appliedConfigVersion: number;
    alarmAdapter?: string;
    activeAlarmCount?: number;
};
export type Model = {
    id: string;
    name: string;
    active: boolean;
    metrics: Record<string, unknown>;
    thresholds: Record<string, number>;
};
export type Overview = {
    totals?: {
        open: number;
        acknowledged: number;
        critical: number;
        compliance: number;
    };
    truncatedActive?: boolean;
    cursor: number;
    serverTime: string;
    alerts: Incident[];
    recent: Incident[];
    cameras: Camera[];
    nodes: EdgeNode[];
    models: Model[];
    config: {
        version: number;
        params: Record<string, number>;
    };
    sectors: {
        id: string;
        name: string;
    }[];
};
export class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch("/api/backend" + path, { ...options, credentials: "same-origin", cache: "no-store", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("json") ? await response.json() : null;
    if (!response.ok)
        throw new ApiError(typeof body?.message === "string" ? body.message : body?.error || "Request failed. Please try again.", response.status);
    return body as T;
}
export function dateTime(value?: string | null) { return value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Not received"; }
export function age(value?: string | null) { if (!value)
    return "Never"; const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000)); return seconds < 60 ? seconds + "s ago" : seconds < 3600 ? Math.floor(seconds / 60) + "m ago" : seconds < 86400 ? Math.floor(seconds / 3600) + "h ago" : Math.floor(seconds / 86400) + "d ago"; }
export function incidentTitle(alert: Incident) { return alert.type === "missing_ppe" ? "Missing " + alert.items.map(i => i.replace(/^no_/, "").replaceAll("_", " ")).join(", ") : alert.type === "system_offline" ? "Edge connection lost" : alert.type === "smoking" ? "Restricted smoking" : alert.type === "fire" ? "Fire detected" : alert.type === "smoke" ? "Smoke detected" : alert.type.replaceAll("_", " "); }
const empty: Overview = { cursor: 0, serverTime: "", alerts: [], recent: [], cameras: [], nodes: [], models: [], config: { version: 0, params: {} }, sectors: [] };
type Context = {
    user: User | null;
    data: Overview;
    loading: boolean;
    error: string | null;
    connected: boolean;
    socketState: string;
    search: string;
    setSearch: (s: string) => void;
    refresh: () => Promise<void>;
    transition: (alert: Incident, action: string, note: string) => Promise<Incident>;
    logout: () => Promise<void>;
    sound: boolean;
    toggleSound: () => void;
    pollSeconds: number;
    setPollSeconds: (n: number) => void;
};
const OperationsContext = createContext<Context | null>(null);
export function useOperations() { const value = useContext(OperationsContext); if (!value)
    throw Error("Operations provider is required"); return value; }
export function OperationsProvider({ children }: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [data, setData] = useState(empty);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [socketState, setSocketState] = useState("connecting");
    const [search, setSearch] = useState("");
    const [sound, setSound] = useState(false);
    const [pollSeconds, setPoll] = useState(5);
    const cursor = useRef(0);
    const mounted = useRef(true);
    const merge = useCallback((incoming: Incident) => {
        if (!incoming?.id || !Array.isArray(incoming.items))
            return;
        setData(previous => { const replace = (rows: Incident[]) => { const old = rows.find(a => a.id === incoming.id); if (old && old.version > incoming.version)
            return rows; return [incoming, ...rows.filter(a => a.id !== incoming.id)].sort((a, b) => b.ts.localeCompare(a.ts)); }; return { ...previous, alerts: replace(previous.alerts), recent: replace(previous.recent).slice(0, 20) }; });
    }, []);
    const refresh = useCallback(async () => {
        try {
            const incoming = await api<Overview>("/reports/overview");
            if (!mounted.current)
                return;
            setData(previous => { if (incoming.cursor >= cursor.current)
                return incoming; const known = new Map(incoming.alerts.map(a => [a.id, a])); for (const a of previous.alerts) {
                const current = known.get(a.id);
                if (!current || a.version > current.version)
                    known.set(a.id, a);
            } return { ...incoming, alerts: [...known.values()], recent: previous.recent, cursor: cursor.current }; });
            cursor.current = Math.max(cursor.current, incoming.cursor);
            setConnected(true);
            setError(null);
        }
        catch (e) {
            if (!mounted.current)
                return;
            setConnected(false);
            setError((e as Error).message);
            if (e instanceof ApiError && e.status === 401) {
                setUser(null);
                router.replace("/login");
            }
        }
    }, [router]);
    useEffect(() => {
        mounted.current = true;
        const saved = Number(localStorage.getItem("argus-poll") || 5);
        if ([5, 10, 30].includes(saved))
            setPoll(saved);
        (async () => { try {
            const session = await api<{
                user: User;
            }>("/auth/me");
            await refresh();
            if (mounted.current)
                setUser(session.user);
        }
        catch (e) {
            if (e instanceof ApiError && e.status === 401)
                router.replace("/login");
            else
                setError((e as Error).message);
        }
        finally {
            if (mounted.current)
                setLoading(false);
        } })();
        return () => { mounted.current = false; audioController.stopSiren(); };
    }, [refresh, router]);
    useEffect(() => { if (!user)
        return; const timer = setInterval(() => void refresh(), pollSeconds * 1000); return () => clearInterval(timer); }, [user, refresh, pollSeconds]);
    useEffect(() => {
        if (!user)
            return;
        let socket: WebSocket | null = null;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let disposed = false;
        let wait = 1000;
        let lastMessage = Date.now();
        const connect = () => {
            if (disposed)
                return;
            setSocketState("connecting");
            const configured = process.env.NEXT_PUBLIC_WS_URL;
            const base = configured && !configured.includes("localhost") ? configured : (location.protocol === "https:" ? "wss://" : "ws://") + location.hostname + ":4000/ws";
            const url = new URL(base);
            url.searchParams.set("since", String(cursor.current));
            const token = typeof window !== "undefined" ? localStorage.getItem("argus-token") : null;
            if (token)
                url.searchParams.set("token", token);
            socket = new WebSocket(url);
            socket.onopen = () => { wait = 1000; lastMessage = Date.now(); setSocketState("live"); };
            socket.onmessage = async (event) => { lastMessage = Date.now(); try {
                const message = JSON.parse(event.data);
                if (message.type === "resync") {
                    await refresh();
                    socket?.close();
                    return;
                }
                if (message.seq > 0 && message.seq > cursor.current) {
                    cursor.current = message.seq;
                    merge(message.data);
                }
                if (message.type === "edge.health" || message.type === "camera.status")
                    void refresh();
            }
            catch {
                setError("An invalid live update was received. Refreshing state.");
                void refresh();
            } };
            socket.onclose = () => { if (disposed)
                return; setSocketState("reconnecting"); retry = setTimeout(connect, wait); wait = Math.min(wait * 2, 15000); };
            socket.onerror = () => socket?.close();
        };
        connect();
        const watchdog = setInterval(() => { if (socket?.readyState === WebSocket.OPEN && Date.now() - lastMessage > 16000)
            socket.close(); }, 5000);
        return () => { disposed = true; clearInterval(watchdog); if (retry)
            clearTimeout(retry); socket?.close(); };
    }, [user, merge, refresh]);
    const openCritical = data.alerts.some(a => a.status === "open" && a.severity === "CRITICAL");
    useEffect(() => { if (sound && openCritical)
        audioController.startSiren();
    else
        audioController.stopSiren(); }, [sound, openCritical]);
    const transition = async (alert: Incident, action: string, note: string) => { try {
        const updated = await api<Incident>("/alerts/" + encodeURIComponent(alert.id), { method: "PATCH", body: JSON.stringify({ action, expectedVersion: alert.version, note }) });
        merge(updated);
        void refresh();
        return updated;
    }
    catch (e) {
        if (e instanceof ApiError && e.status === 409)
            await refresh();
        throw e;
    } };
    const logout = async () => { if (typeof window !== "undefined") localStorage.removeItem("argus-token"); await api("/auth/logout", { method: "POST" }); audioController.stopSiren(); router.replace("/login"); };
    const toggleSound = () => { if (!sound && !audioController.unlock()) {
        setError("Audio is unavailable in this browser.");
        return;
    } setSound(s => !s); };
    const setPollSeconds = (n: number) => { setPoll(n); localStorage.setItem("argus-poll", String(n)); };
    return <OperationsContext.Provider value={{ user, data, loading, error, connected, socketState, search, setSearch, refresh, transition, logout, sound, toggleSound, pollSeconds, setPollSeconds }}>{children}</OperationsContext.Provider>;
}
