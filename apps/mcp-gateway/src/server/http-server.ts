import * as http from "node:http";
import type { SessionManager } from "./session-manager.js";

const MCP_SESSION_HEADER = "mcp-session-id";

interface HttpServerOptions {
  port: number;
  hostname: string;
  sessionManager: SessionManager;
  /** Called after initialize completes for a new session, to query roots */
  onSessionInitialized?: (sessionId: string) => void;
}

/**
 * Creates an HTTP server that routes MCP requests to the appropriate
 * session transport. Follows the MCP Streamable HTTP transport spec.
 */
export function createHttpServer(options: HttpServerOptions): http.Server {
  const { sessionManager, onSessionInitialized } = options;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    console.error(
      `[HTTP] ${req.method} ${url.pathname} session=${req.headers[MCP_SESSION_HEADER] ?? "none"}`,
    );

    // --- Health endpoint ---
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          pid: process.pid,
          uptime: process.uptime(),
          sessions: sessionManager.sessionCount,
        }),
      );
      return;
    }

    // --- All non-/mcp paths: return JSON 404 ---
    // This includes OAuth discovery endpoints like
    // /.well-known/oauth-authorization-server
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    const sessionId = req.headers[MCP_SESSION_HEADER] as string | undefined;

    // --- Existing session: route directly to its transport ---
    if (sessionId && sessionManager.hasSession(sessionId)) {
      const transport = sessionManager.getTransport(sessionId);
      if (transport) {
        await transport.handleRequest(req, res);
        return;
      }
    }

    // --- No session: this must be a new initialize request ---
    if (req.method === "POST") {
      // Create a new session (Server + Transport pair)
      const session = await sessionManager.createSession();

      // Let the transport handle the full request including body reading.
      // Do NOT read the body ourselves — the SDK transport needs the raw stream.
      await session.entry.transport.handleRequest(req, res);

      // After the response is sent, notify about the new session
      res.on("finish", () => {
        const transport = session.entry.transport;
        const transportSessionId = (
          transport as unknown as { sessionId?: string }
        ).sessionId;
        if (
          transportSessionId &&
          sessionManager.hasSession(transportSessionId) &&
          onSessionInitialized
        ) {
          onSessionInitialized(transportSessionId);
        }
      });

      return;
    }

    // --- GET/DELETE without valid session ---
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid_session" }));
  });

  return server;
}
