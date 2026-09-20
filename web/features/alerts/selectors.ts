import { Alert, Severity } from "@/lib/types";
import { SEVERITY_RANK } from "@/lib/severity";

/**
 * Live Alert Queue selector:
 * 1. Critical alerts always on top (rank 0)
 * 2. Warnings next (rank 1)
 * 3. Compliance violations next (rank 2)
 * 4. Sub-sort by timestamp descending (newest first)
 */
export const selectQueue = (byId: Record<string, Alert>): Alert[] => {
  return Object.values(byId)
    .filter((a) => a.status === "open" || a.status === "acknowledged")
    .sort((a, b) => {
      const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.ts).getTime() - new Date(a.ts).getTime();
    });
};

/**
 * Filter alerts requiring urgent audio alarm intervention (open CRITICAL alerts).
 */
export const selectUnackedCritical = (byId: Record<string, Alert>): Alert[] => {
  return Object.values(byId).filter((a) => a.severity === "CRITICAL" && a.status === "open");
};

/**
 * Historical audit log: all records sorted chronologically descending.
 */
export const selectHistory = (byId: Record<string, Alert>): Alert[] => {
  return Object.values(byId).sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );
};

/**
 * Filter alerts by camera ID.
 */
export const selectCameraActiveAlerts = (
  byId: Record<string, Alert>,
  cameraId: string
): Alert[] => {
  return Object.values(byId).filter(
    (a) => a.cameraId === cameraId && (a.status === "open" || a.status === "acknowledged")
  );
};

/**
 * Summary metrics for dashboard badges and headers.
 */
export const selectMetrics = (byId: Record<string, Alert>) => {
  const all = Object.values(byId);
  const active = all.filter((a) => a.status === "open" || a.status === "acknowledged");

  return {
    total: all.length,
    activeCount: active.length,
    criticalCount: active.filter((a) => a.severity === "CRITICAL").length,
    warningCount: active.filter((a) => a.severity === "WARNING").length,
    complianceCount: active.filter((a) => a.severity === "COMPLIANCE").length,
    resolvedCount: all.filter((a) => a.status === "resolved" || a.status === "false_alarm").length,
  };
};
