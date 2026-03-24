import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  getConfig,
  saveConfig,
  getGatewayStatus,
  listSkills,
  getSkill,
  saveSkill,
  deleteSkill,
  installMarketplaceSkill,
  type SkillManagementConfig,
  type DownstreamServerConfig,
  type GatewayStatus,
  type SkillMetadata,
  type SkillContent,
} from "@/lib/tauri-commands";

// --- Config ---

interface ConfigState {
  config: SkillManagementConfig | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  updateConfig: (
    updater: (prev: SkillManagementConfig) => SkillManagementConfig,
  ) => Promise<void>;
  addServer: (key: string, serverConfig: DownstreamServerConfig) => Promise<void>;
  removeServer: (key: string) => Promise<void>;
  updateServer: (key: string, serverConfig: DownstreamServerConfig) => Promise<void>;
  toggleServer: (key: string) => Promise<void>;
}

// --- Gateway Status ---

interface GatewayStatusState {
  status: GatewayStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

// --- Skills ---

interface SkillsState {
  skills: SkillMetadata[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  loadSkill: (id: string) => Promise<SkillContent>;
  createSkill: (id: string, content: string) => Promise<void>;
  updateSkill: (id: string, content: string) => Promise<void>;
  removeSkill: (id: string) => Promise<void>;
  installFromMarketplace: (command: string) => Promise<string>;
}

// --- Combined Context ---

interface AppContextValue {
  config: ConfigState;
  gatewayStatus: GatewayStatusState;
  skills: SkillsState;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // ========== Config State ==========
  const [configData, setConfigData] = useState<SkillManagementConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const cfg = await getConfig();
      setConfigData(cfg);
    } catch (err) {
      setConfigError(String(err));
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateConfigFn = useCallback(
    async (updater: (prev: SkillManagementConfig) => SkillManagementConfig) => {
      if (!configData) return;
      try {
        const updated = updater(configData);
        await saveConfig(updated);
        setConfigData(updated);
      } catch (err) {
        setConfigError(String(err));
        throw err;
      }
    },
    [configData],
  );

  const addServer = useCallback(
    async (key: string, serverConfig: DownstreamServerConfig) => {
      await updateConfigFn((prev) => ({
        ...prev,
        servers: { ...prev.servers, [key]: serverConfig },
      }));
    },
    [updateConfigFn],
  );

  const removeServer = useCallback(
    async (key: string) => {
      await updateConfigFn((prev) => {
        const { [key]: _, ...rest } = prev.servers;
        return { ...prev, servers: rest };
      });
    },
    [updateConfigFn],
  );

  const updateServer = useCallback(
    async (key: string, serverConfig: DownstreamServerConfig) => {
      await updateConfigFn((prev) => ({
        ...prev,
        servers: { ...prev.servers, [key]: serverConfig },
      }));
    },
    [updateConfigFn],
  );

  const toggleServer = useCallback(
    async (key: string) => {
      if (!configData?.servers[key]) return;
      await updateConfigFn((prev) => ({
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
    [configData, updateConfigFn],
  );

  // ========== Gateway Status State ==========
  // Stabilize status: require 2 consecutive "disconnected" polls before
  // marking a previously-connected server as disconnected (prevents flicker).
  const [gwStatus, setGwStatus] = useState<GatewayStatus | null>(null);
  const [gwLoading, setGwLoading] = useState(true);
  const disconnectCountsRef = useRef<Record<string, number>>({});

  const refreshGwStatus = useCallback(async () => {
    try {
      const raw = await getGatewayStatus();

      // Stabilize per-server connection status
      if (raw.running) {
        const counts = disconnectCountsRef.current;
        const stabilized = { ...raw, servers: { ...raw.servers } };

        for (const [key, serverStatus] of Object.entries(raw.servers)) {
          if (serverStatus.connected) {
            // Reset disconnect counter when connected
            counts[key] = 0;
          } else {
            // Increment disconnect counter
            counts[key] = (counts[key] ?? 0) + 1;

            // If we had a previous status where this server was connected,
            // and it's only been disconnected for 1 poll, keep showing connected
            if (counts[key]! < 2 && gwStatus?.servers[key]?.connected) {
              stabilized.servers[key] = gwStatus.servers[key]!;
            }
          }
        }

        // Clean up counters for removed servers
        for (const key of Object.keys(counts)) {
          if (!(key in raw.servers)) {
            delete counts[key];
          }
        }

        setGwStatus(stabilized);
      } else {
        disconnectCountsRef.current = {};
        setGwStatus(raw);
      }
    } catch {
      setGwStatus(null);
    } finally {
      setGwLoading(false);
    }
  }, [gwStatus]);

  useEffect(() => {
    refreshGwStatus();
    const interval = setInterval(refreshGwStatus, 5000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== Skills State ==========
  const [skillsList, setSkillsList] = useState<SkillMetadata[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const loadSkillsList = useCallback(async () => {
    try {
      setSkillsLoading(true);
      setSkillsError(null);
      const result = await listSkills();
      setSkillsList(result);
    } catch (err) {
      setSkillsError(String(err));
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkillsList();
  }, [loadSkillsList]);

  const loadSkillFn = useCallback(async (id: string): Promise<SkillContent> => {
    return getSkill(id);
  }, []);

  const createSkillFn = useCallback(
    async (id: string, content: string) => {
      await saveSkill(id, content);
      await loadSkillsList();
    },
    [loadSkillsList],
  );

  const updateSkillFn = useCallback(
    async (id: string, content: string) => {
      await saveSkill(id, content);
      await loadSkillsList();
    },
    [loadSkillsList],
  );

  const removeSkillFn = useCallback(
    async (id: string) => {
      await deleteSkill(id);
      await loadSkillsList();
    },
    [loadSkillsList],
  );

  const installFromMarketplaceFn = useCallback(
    async (command: string): Promise<string> => {
      const skillName = await installMarketplaceSkill(command);
      await loadSkillsList();
      return skillName;
    },
    [loadSkillsList],
  );

  // ========== Context Value ==========
  const value: AppContextValue = {
    config: {
      config: configData,
      loading: configLoading,
      error: configError,
      reload: loadConfig,
      updateConfig: updateConfigFn,
      addServer,
      removeServer,
      updateServer,
      toggleServer,
    },
    gatewayStatus: {
      status: gwStatus,
      loading: gwLoading,
      refresh: refreshGwStatus,
    },
    skills: {
      skills: skillsList,
      loading: skillsLoading,
      error: skillsError,
      reload: loadSkillsList,
      loadSkill: loadSkillFn,
      createSkill: createSkillFn,
      updateSkill: updateSkillFn,
      removeSkill: removeSkillFn,
      installFromMarketplace: installFromMarketplaceFn,
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppConfig must be used within AppProvider");
  return ctx.config;
}

export function useAppGatewayStatus() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppGatewayStatus must be used within AppProvider");
  return ctx.gatewayStatus;
}

export function useAppSkills() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppSkills must be used within AppProvider");
  return ctx.skills;
}
