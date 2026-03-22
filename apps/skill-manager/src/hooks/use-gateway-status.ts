import { useState, useEffect, useCallback } from "react";
import { getGatewayStatus, type GatewayStatus } from "@/lib/tauri-commands";

export function useGatewayStatus(pollIntervalMs = 5000) {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await getGatewayStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  return { status, loading, refresh };
}
