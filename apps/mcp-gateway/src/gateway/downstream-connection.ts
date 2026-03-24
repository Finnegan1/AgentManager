import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import type { DownstreamServerConfig } from "@repo/shared-types";

export interface DownstreamCapabilities {
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  prompts: Prompt[];
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface DownstreamConnectionEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  capabilitiesChanged: () => void;
}

/**
 * Wraps a single MCP Client connection to a downstream server.
 * Handles transport creation, connection lifecycle, and capability discovery.
 */
export class DownstreamConnection {
  private client: Client;
  private transport: Transport | null = null;
  private _status: ConnectionStatus = "disconnected";
  private _capabilities: DownstreamCapabilities = {
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: [],
  };
  private _error: string | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 10;
  private onStatusChange?: (
    serverKey: string,
    status: ConnectionStatus,
  ) => void;
  private onCapabilitiesChanged?: (serverKey: string) => void;

  constructor(
    readonly serverKey: string,
    private config: DownstreamServerConfig,
  ) {
    this.client = new Client(
      { name: `skill-gateway-proxy-${serverKey}`, version: "0.1.0" },
      {
        capabilities: {},
      },
    );
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get capabilities(): DownstreamCapabilities {
    return this._capabilities;
  }

  get error(): string | undefined {
    return this._error;
  }

  /** Set callback for status changes */
  setStatusChangeHandler(
    handler: (serverKey: string, status: ConnectionStatus) => void,
  ): void {
    this.onStatusChange = handler;
  }

  /** Set callback for capability changes */
  setCapabilitiesChangedHandler(
    handler: (serverKey: string) => void,
  ): void {
    this.onCapabilitiesChanged = handler;
  }

  /** Connect to the downstream server and discover capabilities */
  async connect(): Promise<void> {
    if (this._status === "connecting" || this._status === "connected") {
      return;
    }

    this.setStatus("connecting");
    this._error = undefined;

    try {
      this.transport = this.createTransport();

      this.transport.onclose = () => {
        this.setStatus("disconnected");
        this._capabilities = {
          tools: [],
          resources: [],
          resourceTemplates: [],
          prompts: [],
        };
        this.onCapabilitiesChanged?.(this.serverKey);
        this.scheduleReconnect();
      };

      this.transport.onerror = (error) => {
        console.error(
          `[${this.serverKey}] Transport error:`,
          error.message,
        );
      };

      await this.client.connect(this.transport);
      await this.discoverCapabilities();

      this.reconnectAttempt = 0;
      this.setStatus("connected");
    } catch (err) {
      const error = err as Error;
      this._error = error.message;
      this.setStatus("error");
      console.error(`[${this.serverKey}] Connection failed:`, error.message);
      this.scheduleReconnect();
    }
  }

  /** Disconnect from the downstream server */
  async disconnect(): Promise<void> {
    this.cancelReconnect();

    try {
      await this.client.close();
    } catch {
      // Ignore close errors
    }

    this.transport = null;
    this._capabilities = {
      tools: [],
      resources: [],
      resourceTemplates: [],
      prompts: [],
    };
    this.setStatus("disconnected");
  }

  /** Forward a tool call to the downstream server */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: Array<{ type: string; [key: string]: unknown }>;
    isError?: boolean;
  }> {
    if (this._status !== "connected") {
      return {
        content: [
          {
            type: "text",
            text: `Server "${this.config.name}" is not connected (status: ${this._status})`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });
      return result as {
        content: Array<{ type: string; [key: string]: unknown }>;
        isError?: boolean;
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error calling tool "${toolName}" on server "${this.config.name}": ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /** Forward a resource read to the downstream server */
  async readResource(uri: string): Promise<{
    contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>;
  }> {
    if (this._status !== "connected") {
      throw new Error(
        `Server "${this.config.name}" is not connected (status: ${this._status})`,
      );
    }

    const result = await this.client.readResource({ uri });
    return result as {
      contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>;
    };
  }

  /** Forward a prompt get to the downstream server */
  async getPrompt(
    promptName: string,
    args?: Record<string, string>,
  ): Promise<{
    description?: string;
    messages: Array<{ role: string; content: { type: string; text?: string } }>;
  }> {
    if (this._status !== "connected") {
      throw new Error(
        `Server "${this.config.name}" is not connected (status: ${this._status})`,
      );
    }

    const result = await this.client.getPrompt({
      name: promptName,
      arguments: args,
    });
    return result as {
      description?: string;
      messages: Array<{
        role: string;
        content: { type: string; text?: string };
      }>;
    };
  }

  /** Create the appropriate transport based on config */
  private createTransport(): Transport {
    switch (this.config.transport.type) {
      case "stdio":
        return new StdioClientTransport({
          command: this.config.transport.command,
          args: this.config.transport.args,
          env: this.config.transport.env
            ? Object.fromEntries(
                Object.entries({ ...process.env, ...this.config.transport.env })
                  .filter((entry): entry is [string, string] => entry[1] !== undefined),
              )
            : undefined,
          cwd: this.config.transport.cwd,
        });

      case "sse":
        return new SSEClientTransport(new URL(this.config.transport.url), {
          requestInit: this.config.transport.headers
            ? { headers: this.config.transport.headers }
            : undefined,
        });

      case "streamable-http":
        return new StreamableHTTPClientTransport(
          new URL(this.config.transport.url),
          {
            requestInit: this.config.transport.headers
              ? { headers: this.config.transport.headers }
              : undefined,
          },
        );
    }
  }

  /** Discover tools, resources, and prompts from the downstream server */
  private async discoverCapabilities(): Promise<void> {
    const serverCaps = this.client.getServerCapabilities();

    // Discover tools
    const tools: Tool[] = [];
    if (serverCaps?.tools) {
      try {
        const result = await this.client.listTools();
        tools.push(...result.tools);
      } catch (err) {
        console.error(`[${this.serverKey}] Failed to list tools:`, err);
      }
    }

    // Discover resources
    const resources: Resource[] = [];
    const resourceTemplates: ResourceTemplate[] = [];
    if (serverCaps?.resources) {
      try {
        const result = await this.client.listResources();
        resources.push(...result.resources);
      } catch (err) {
        console.error(`[${this.serverKey}] Failed to list resources:`, err);
      }

      try {
        const result = await this.client.listResourceTemplates();
        resourceTemplates.push(...result.resourceTemplates);
      } catch (err) {
        console.error(
          `[${this.serverKey}] Failed to list resource templates:`,
          err,
        );
      }
    }

    // Discover prompts
    const prompts: Prompt[] = [];
    if (serverCaps?.prompts) {
      try {
        const result = await this.client.listPrompts();
        prompts.push(...result.prompts);
      } catch (err) {
        console.error(`[${this.serverKey}] Failed to list prompts:`, err);
      }
    }

    this._capabilities = { tools, resources, resourceTemplates, prompts };
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.onStatusChange?.(this.serverKey, status);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.error(
        `[${this.serverKey}] Max reconnect attempts reached`,
      );
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      30000,
    );
    this.reconnectAttempt++;

    console.log(
      `[${this.serverKey}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`,
    );

    this.reconnectTimer = setTimeout(async () => {
      // Re-create the client for a fresh connection
      this.client = new Client(
        { name: `skill-gateway-proxy-${this.serverKey}`, version: "0.1.0" },
        { capabilities: {} },
      );
      await this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
  }
}
