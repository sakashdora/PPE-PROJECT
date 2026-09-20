import { useAlertsStore } from "@/features/alerts/alerts.store";
import { Alert } from "@/lib/types";
import demoData from "@/scenarios/demo.json";

export class MockDemoEngine {
  public static triggerStep(stepIndex: number) {
    const store = useAlertsStore.getState();
    const step = demoData.steps[stepIndex];
    if (!step) return;

    if (step.event.type === "alert.created") {
      const alert = step.event.data as unknown as Alert;
      store.upsert(alert);
      store.setDemoNotice(`${step.title}: ${step.description}`);
    } else if (step.event.type === "corner_case.verified") {
      const data = step.event.data as {
        testType: string;
        outcome: string;
        fireConfidence: number;
        helmetConfidence: number;
        message: string;
      };
      store.setDemoNotice(
        `Corner Case Test: Yellow Shirt & Cap verified. Fire conf: ${(
          data.fireConfidence * 100
        ).toFixed(1)}%, Helmet conf: ${(data.helmetConfidence * 100).toFixed(
          1
        )}% -> ZERO FALSE ALARM.`
      );
    }
  }

  public static simulateDisconnect() {
    const store = useAlertsStore.getState();
    store.setConn("reconnecting");
    store.setDemoNotice("Network disconnected: System is operating in offline mode using local cache.");
  }

  public static simulateReconnect() {
    const store = useAlertsStore.getState();
    store.setConn("live");
    store.setDemoNotice("Network reconnected: Synchronized catch-up events from on-prem edge outbox.");
  }

  public static reset() {
    const store = useAlertsStore.getState();
    store.resetDemoData();
  }
}
