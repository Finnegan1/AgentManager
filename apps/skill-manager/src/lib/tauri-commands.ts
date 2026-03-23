import { invoke } from "@tauri-apps/api/core";

// --- Config Types (mirroring shared-types) ---

export interface StdioTransportConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface SseTransportConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export interface StreamableHttpTransportConfig {
  type: "streamable-http";
  url: string;
  headers?: Record<string, string>;
}

export type TransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | StreamableHttpTransportConfig;

export type ServerScope = "global" | "project";

export interface DownstreamServerConfig {
  name: string;
  enabled: boolean;
  scope?: ServerScope;
  transport: TransportConfig;
}

export interface SkillManagementConfig {
  version: string;
  gateway: {
    autoStart: boolean;
  };
  servers: Record<string, DownstreamServerConfig>;
  skills: {
    directory: string;
  };
}

export interface SkillMetadata {
  id: string;
  name: string;
  tags: string[];
  description: string;
  version: string;
  author: string;
  created: string;
  updated: string;
  // Claude Code-specific fields (optional)
  allowedTools?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  context?: string;
  agent?: string;
  model?: string;
  argumentHint?: string;
}

export interface SkillFileInfo {
  relativePath: string;
  isDirectory: boolean;
  size: number;
}

export interface SkillContent {
  metadata: SkillMetadata;
  content: string;
  files: SkillFileInfo[];
}

export interface ServerConnectionStatus {
  connected: boolean;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  error?: string;
}

export interface GatewayStatus {
  running: boolean;
  pid?: number;
  startedAt?: string;
  servers: Record<string, ServerConnectionStatus>;
}

// --- Tauri IPC Commands ---

export async function getConfig(): Promise<SkillManagementConfig> {
  return invoke<SkillManagementConfig>("get_config");
}

export async function saveConfig(
  config: SkillManagementConfig,
): Promise<void> {
  return invoke("save_config", { config });
}

export async function listSkills(): Promise<SkillMetadata[]> {
  return invoke<SkillMetadata[]>("list_skills");
}

export async function getSkill(name: string): Promise<SkillContent> {
  return invoke<SkillContent>("get_skill", { name });
}

export async function saveSkill(
  name: string,
  content: string,
): Promise<void> {
  return invoke("save_skill", { name, content });
}

export async function deleteSkill(name: string): Promise<void> {
  return invoke("delete_skill", { name });
}

export async function listSkillFiles(
  name: string,
): Promise<SkillFileInfo[]> {
  return invoke<SkillFileInfo[]>("list_skill_files", { name });
}

export async function saveSkillFile(
  name: string,
  relativePath: string,
  content: string,
): Promise<void> {
  return invoke("save_skill_file", { name, relativePath, content });
}

export async function deleteSkillFile(
  name: string,
  relativePath: string,
): Promise<void> {
  return invoke("delete_skill_file", { name, relativePath });
}

export async function createSkillDirectory(
  name: string,
  relativePath: string,
): Promise<void> {
  return invoke("create_skill_directory", { name, relativePath });
}

export async function installMarketplaceSkill(
  command: string,
): Promise<string> {
  return invoke<string>("install_marketplace_skill", { command });
}

export async function getGatewayStatus(): Promise<GatewayStatus> {
  return invoke<GatewayStatus>("get_gateway_status");
}

// --- Agent Bridge Commands ---

export interface AgentBridgeStatus {
  running: boolean;
  port: number | null;
}

export async function startAgentBridge(): Promise<number> {
  return invoke<number>("start_agent_bridge");
}

export async function stopAgentBridge(): Promise<void> {
  return invoke("stop_agent_bridge");
}

export async function getAgentBridgeStatus(): Promise<AgentBridgeStatus> {
  return invoke<AgentBridgeStatus>("get_agent_bridge_status");
}
