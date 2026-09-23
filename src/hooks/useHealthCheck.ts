import { useState, useEffect, useCallback } from "react";

export type HealthStatus = "connected" | "connecting" | "offline";

export function useHealthCheck(intervalMs = 25000) {
  const [status, setStatus] = useState<HealthStatus>("connecting");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("/api/health", {
        method: "GET",
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setStatus("connected");
      } else {
        setStatus("offline");
      }
    } catch {
      setStatus("offline");
    } finally {
      setLastCheck(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, intervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, intervalMs]);

  return { status, lastCheck, refetch: checkHealth };
}
