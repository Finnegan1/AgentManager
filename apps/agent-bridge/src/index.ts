import { WebSocketServer, type WebSocket } from "ws";
import { AgentManager } from "./agent.js";
import type { ClientMessage, ServerMessage } from "./protocol.js";

async function main() {
  // Use port 0 to let the OS assign a free port
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });

  await new Promise<void>((resolve) => {
    wss.once("listening", resolve);
  });

  const addr = wss.address();
  const port = addr && typeof addr === "object" ? addr.port : 0;

  // Print port to stdout for Tauri to read
  process.stdout.write(`${port}\n`);

  let currentAgent: AgentManager | null = null;

  wss.on("connection", (ws: WebSocket) => {
    const agent = new AgentManager();
    currentAgent = agent;

    const send = (msg: ServerMessage) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    // Initialize the agent session
    agent.initialize(send).catch((err) => {
      send({ type: "error", message: `Failed to initialize: ${err instanceof Error ? err.message : String(err)}` });
    });

    ws.on("message", async (data) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());

        switch (msg.type) {
          case "prompt":
            await agent.handlePrompt(msg.text, send);
            break;
          case "cancel":
            await agent.handleCancel();
            break;
          case "permission_response":
            agent.handlePermissionResponse(msg.requestId, msg.optionId);
            break;
        }
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    ws.on("close", async () => {
      await agent.destroy();
      if (currentAgent === agent) {
        currentAgent = null;
      }
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    if (currentAgent) {
      await currentAgent.destroy();
    }
    wss.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Exit if parent process disconnects (orphan detection)
  process.stdin.resume();
  process.stdin.on("end", shutdown);
}

main().catch((err) => {
  process.stderr.write(`agent-bridge fatal: ${err}\n`);
  process.exit(1);
});
