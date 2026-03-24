import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SkillManagementConfigSchema } from "./config-schema.js";
import type { SkillManagementConfig } from "@repo/shared-types";

const CONFIG_DIR = path.join(os.homedir(), ".agent-manager");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const SKILLS_DIR = path.join(CONFIG_DIR, "skills");

export interface ConfigStoreEvents {
  changed: [config: SkillManagementConfig, previous: SkillManagementConfig];
  error: [error: Error];
}

/**
 * Reads, validates, and watches the agent-manager config file.
 * Emits 'changed' events when the config file is modified.
 */
export class ConfigStore extends EventEmitter<ConfigStoreEvents> {
  private currentConfig: SkillManagementConfig;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.ensureDirectories();
    this.currentConfig = this.loadConfig();
  }

  /** Get the current config */
  get config(): SkillManagementConfig {
    return this.currentConfig;
  }

  /** Get the config directory path */
  get configDir(): string {
    return CONFIG_DIR;
  }

  /** Get the config file path */
  get configPath(): string {
    return CONFIG_PATH;
  }

  /** Start watching the config file for changes */
  startWatching(): void {
    if (this.watcher) return;

    const configFilename = path.basename(CONFIG_PATH);

    try {
      // Watch the DIRECTORY instead of the file. On macOS under Bun,
      // fs.watch on a file uses kqueue which tracks the inode. Atomic
      // writes (tmp + rename) replace the inode, causing the watcher
      // to go stale. Directory-level watching uses FSEvents which
      // reliably detects atomic renames.
      this.watcher = fs.watch(CONFIG_DIR, (_eventType, filename) => {
        // Only react to changes to our config file (not tmp files, status, etc.)
        if (filename !== configFilename) return;

        // Debounce to avoid rapid successive events
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.reloadConfig();
        }, 200);
      });

      this.watcher.on("error", (err) => {
        this.emit("error", err);
      });

      // Low-frequency polling fallback (stat-based) as a safety net
      // in case fs.watch fails silently on some runtime/OS combination.
      // reloadConfig() already does a JSON deep-equality check, so
      // duplicate triggers from both watchers are harmless.
      fs.watchFile(CONFIG_PATH, { interval: 5000 }, (curr, prev) => {
        if (curr.mtimeMs !== prev.mtimeMs) {
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            this.reloadConfig();
          }, 200);
        }
      });
    } catch (err) {
      this.emit("error", err as Error);
    }
  }

  /** Stop watching the config file */
  stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    fs.unwatchFile(CONFIG_PATH);
  }

  /** Reload config from disk and emit changed event if different */
  private reloadConfig(): void {
    try {
      const newConfig = this.loadConfig();
      const previous = this.currentConfig;

      // Simple deep equality check via JSON serialization
      if (JSON.stringify(newConfig) !== JSON.stringify(previous)) {
        this.currentConfig = newConfig;
        this.emit("changed", newConfig, previous);
      }
    } catch (err) {
      this.emit("error", err as Error);
    }
  }

  /** Load and validate the config file from disk */
  private loadConfig(): SkillManagementConfig {
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig = this.createDefaultConfig();
      this.writeConfig(defaultConfig);
      return defaultConfig;
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const result = SkillManagementConfigSchema.safeParse(parsed);

    if (!result.success) {
      console.error(
        "Config validation failed, using defaults:",
        result.error.issues,
      );
      return this.createDefaultConfig();
    }

    return result.data as SkillManagementConfig;
  }

  /** Create the default config */
  private createDefaultConfig(): SkillManagementConfig {
    return {
      version: "1.0",
      gateway: {
        autoStart: false,
      },
      servers: {},
      skills: {
        directory: SKILLS_DIR,
      },
    };
  }

  /** Write config to disk atomically (write to temp, then rename) */
  private writeConfig(config: SkillManagementConfig): void {
    const tmpPath = CONFIG_PATH + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
    fs.renameSync(tmpPath, CONFIG_PATH);
  }

  /** Ensure required directories exist */
  private ensureDirectories(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (!fs.existsSync(SKILLS_DIR)) {
      fs.mkdirSync(SKILLS_DIR, { recursive: true });
    }
  }
}
