import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { DownstreamServerConfig, TransportConfig } from "@/lib/tauri-commands";

interface ServerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (key: string, config: DownstreamServerConfig) => Promise<void>;
  initialKey?: string;
  initialConfig?: DownstreamServerConfig;
}

export function ServerForm({
  open,
  onOpenChange,
  onSave,
  initialKey,
  initialConfig,
}: ServerFormProps) {
  const [serverKey, setServerKey] = useState(initialKey ?? "");
  const [name, setName] = useState(initialConfig?.name ?? "");
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true);
  const [transportType, setTransportType] = useState<TransportConfig["type"]>(
    initialConfig?.transport.type ?? "stdio",
  );

  // Stdio fields
  const [command, setCommand] = useState(
    initialConfig?.transport.type === "stdio"
      ? initialConfig.transport.command
      : "",
  );
  const [args, setArgs] = useState(
    initialConfig?.transport.type === "stdio"
      ? (initialConfig.transport.args?.join(" ") ?? "")
      : "",
  );
  const [envText, setEnvText] = useState(
    initialConfig?.transport.type === "stdio" && initialConfig.transport.env
      ? Object.entries(initialConfig.transport.env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")
      : "",
  );
  const [cwd, setCwd] = useState(
    initialConfig?.transport.type === "stdio"
      ? (initialConfig.transport.cwd ?? "")
      : "",
  );

  // URL-based fields (SSE, Streamable HTTP)
  const [url, setUrl] = useState(
    initialConfig?.transport.type === "sse" ||
      initialConfig?.transport.type === "streamable-http"
      ? initialConfig.transport.url
      : "",
  );
  const [headersText, setHeadersText] = useState(
    (initialConfig?.transport.type === "sse" ||
      initialConfig?.transport.type === "streamable-http") &&
      initialConfig?.transport.headers
      ? Object.entries(initialConfig.transport.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : "",
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!serverKey.trim() || !name.trim()) return;

    let transport: TransportConfig;

    switch (transportType) {
      case "stdio":
        transport = {
          type: "stdio",
          command: command.trim(),
          ...(args.trim() ? { args: args.trim().split(/\s+/) } : {}),
          ...(envText.trim()
            ? {
                env: Object.fromEntries(
                  envText
                    .trim()
                    .split("\n")
                    .filter((l) => l.includes("="))
                    .map((l) => {
                      const idx = l.indexOf("=");
                      return [l.slice(0, idx), l.slice(idx + 1)];
                    }),
                ),
              }
            : {}),
          ...(cwd.trim() ? { cwd: cwd.trim() } : {}),
        };
        break;
      case "sse":
        transport = {
          type: "sse",
          url: url.trim(),
          ...(headersText.trim()
            ? {
                headers: Object.fromEntries(
                  headersText
                    .trim()
                    .split("\n")
                    .filter((l) => l.includes(":"))
                    .map((l) => {
                      const idx = l.indexOf(":");
                      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
                    }),
                ),
              }
            : {}),
        };
        break;
      case "streamable-http":
        transport = {
          type: "streamable-http",
          url: url.trim(),
          ...(headersText.trim()
            ? {
                headers: Object.fromEntries(
                  headersText
                    .trim()
                    .split("\n")
                    .filter((l) => l.includes(":"))
                    .map((l) => {
                      const idx = l.indexOf(":");
                      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
                    }),
                ),
              }
            : {}),
        };
        break;
    }

    try {
      setSaving(true);
      await onSave(serverKey.trim(), { name: name.trim(), enabled, transport });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save server:", err);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!initialKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Server bearbeiten" : "Server hinzufugen"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serverKey">Server-Key</Label>
              <Input
                id="serverKey"
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
                placeholder="z.B. github"
                disabled={isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. GitHub MCP"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>Aktiviert</Label>
          </div>

          <div className="space-y-2">
            <Label>Transport-Typ</Label>
            <Select
              value={transportType}
              onValueChange={(v) =>
                setTransportType(v as TransportConfig["type"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">Stdio</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
                <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {transportType === "stdio" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <Input
                  id="command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="z.B. npx oder node"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="args">Argumente (Leerzeichen-getrennt)</Label>
                <Input
                  id="args"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="z.B. -y @modelcontextprotocol/server-github"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="env">
                  Umgebungsvariablen (KEY=VALUE, eine pro Zeile)
                </Label>
                <Textarea
                  id="env"
                  value={envText}
                  onChange={(e) => setEnvText(e.target.value)}
                  placeholder={"GITHUB_TOKEN=ghp_...\nNODE_ENV=production"}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cwd">Arbeitsverzeichnis (optional)</Label>
                <Input
                  id="cwd"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="/pfad/zum/verzeichnis"
                />
              </div>
            </>
          )}

          {(transportType === "sse" || transportType === "streamable-http") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headers">
                  Headers (Key: Value, eine pro Zeile)
                </Label>
                <Textarea
                  id="headers"
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  placeholder={"Authorization: Bearer token123"}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !serverKey.trim() || !name.trim()}>
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
