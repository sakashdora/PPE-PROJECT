export function parseJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string')
        return (value ?? fallback) as T;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
export function alertDto(alert: any) {
    return {
        id: alert.id, cameraId: alert.cameraId, cameraName: alert.camera?.name || alert.cameraId,
        sector: alert.camera?.sector?.name || '', zoneId: alert.zoneId,
        ts: new Date(alert.firstSeenAt).toISOString(), updatedAt: new Date(alert.lastSeenAt).toISOString(),
        severity: alert.severity, type: alert.type === 'ppe_missing' ? 'missing_ppe' : alert.type,
        items: parseJson(alert.items, []), confidence: alert.confidence, votes: alert.votes || '',
        hitCount: alert.hitCount, status: alert.status.toLowerCase(), version: alert.version,
        modelVersion: alert.modelVersion || null, bbox: parseJson(alert.bbox, null),
        snapshotUrl: alert.snapshotPath ? `/api/backend/alerts/${encodeURIComponent(alert.id)}/snapshot` : null,
        ackBy: alert.ackById, ackAt: alert.ackAt, resolvedAt: alert.resolvedAt,
        note: alert.note || '',
    };
}
export const cameraInclude = { sector: true, zones: true, edgeNode: true };
export const alertInclude = { camera: { include: { sector: true } } };
export function cameraDto(camera: any, includeSource = false) {
    const frameAgeMs = camera.lastFrameAt ? Math.max(0, Date.now() - new Date(camera.lastFrameAt).getTime()) : null;
    const status = !camera.enabled ? 'disabled' : frameAgeMs === null ? 'unknown' : frameAgeMs > 15000 ? 'stalled' : camera.status;
    return {
        id: camera.id, name: camera.name, sector: camera.sector?.name || '', sectorId: camera.sectorId,
        edgeNodeId: camera.edgeNodeId, edgeNodeName: camera.edgeNode?.name,
        enabled: camera.enabled, status, fps: camera.fps, latencyMs: camera.latencyMs,
        lastFrameAt: camera.lastFrameAt, frameAgeMs, sourceType: camera.streamUrlEnc === 'synthetic' ? 'demonstration' : 'camera',
        ...(includeSource ? { source: camera.streamUrlEnc } : {}),
        previewUrl: `/api/preview/${encodeURIComponent(camera.id)}`,
        zones: (camera.zones || []).map((zone: any) => ({ ...zone, polygon: parseJson(zone.polygon, []), requiredPpe: parseJson(zone.requiredPpe, ['helmet', 'vest']) })),
    };
}
