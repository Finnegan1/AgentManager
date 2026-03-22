import { useState, useEffect, useCallback } from "react";
import {
  getConfig,
  saveConfig,
  type SkillManagementConfig,
  type DownstreamServerConfig,
} from "@/lib/tauri-commands";

export function useConfig() {
  const [config, setConfig] = useState<SkillManagementConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const cfg = await getConfig();
      setConfig(cfg);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateConfig = useCallback(
    async (updater: (prev: SkillManagementConfig) => SkillManagementConfig) => {
      if (!config) return;
      try {
        const updated = updater(config);
        await saveConfig(updated);
        setConfig(updated);
      } catch (err) {
        setError(String(err));
        throw err;
      }
    },
    [config],
  );

  const addServer = useCallback(
    async (key: string, serverConfig: DownstreamServerConfig) => {
      await updateConfig((prev) => ({
        ...prev,
        servers: { ...prev.servers, [key]: serverConfig },
      }));
    },
    [updateConfig],
  );

  const removeServer = useCallback(
    async (key: string) => {
      await updateConfig((prev) => {
        const { [key]: _, ...rest } = prev.servers;
        return { ...prev, servers: rest };
      });
    },
    [updateConfig],
  );

  const updateServer = useCallback(
    async (key: string, serverConfig: DownstreamServerConfig) => {
      await updateConfig((prev) => ({
        ...prev,
        servers: { ...prev.servers, [key]: serverConfig },
      }));
    },
    [updateConfig],
  );

  const toggleServer = useCallback(
    async (key: string) => {
      if (!config?.servers[key]) return;
      await updateConfig((prev) => ({
        ...prev,
        servers: {
          ...prev.servers,
          [key]: {
            ...prev.servers[key]!,
            enabled: !prev.servers[key]!.enabled,
          },
        },
      }));
    },
    [config, updateConfig],
  );

  return {
    config,
    loading,
    error,
    reload: loadConfig,
    updateConfig,
    addServer,
    removeServer,
    updateServer,
    toggleServer,
  };
}
