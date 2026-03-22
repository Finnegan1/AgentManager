import type { DownstreamServerConfig } from "./mcp-server-config.js";

/** Root configuration for the skill management platform */
export interface SkillManagementConfig {
  /** Schema version for migration support */
  version: "1.0";
  /** Gateway server settings */
  gateway: {
    /** Whether the gateway auto-starts when the desktop app launches */
    autoStart: boolean;
  };
  /** Map of server key -> downstream server configuration */
  servers: Record<string, DownstreamServerConfig>;
  /** Skill management settings */
  skills: {
    /** Directory containing skill markdown files. Defaults to ~/.skill-management/skills/ */
    directory: string;
  };
}

/** Status information written by the gateway process */
export interface GatewayStatus {
  /** Process ID of the running gateway */
  pid: number;
  /** ISO timestamp of when the gateway started */
  startedAt: string;
  /** Status of each downstream server connection */
  servers: Record<
    string,
    {
      connected: boolean;
      toolCount: number;
      resourceCount: number;
      promptCount: number;
      error?: string;
    }
  >;
}

/** Returns a default configuration */
export function createDefaultConfig(homeDir: string): SkillManagementConfig {
  return {
    version: "1.0",
    gateway: {
      autoStart: false,
    },
    servers: {},
    skills: {
      directory: `${homeDir}/.skill-management/skills`,
    },
  };
}
