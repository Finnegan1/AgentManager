import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useConfig } from "@/hooks/use-config";
import { useGatewayStatus } from "@/hooks/use-gateway-status";
import { ServerForm } from "./server-form";
import type { DownstreamServerConfig } from "@/lib/tauri-commands";

export function ServerList() {
  const { config, addServer, updateServer, removeServer, toggleServer } =
    useConfig();
  const { status } = useGatewayStatus();
  const [formOpen, setFormOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (!config) return null;

  const servers = Object.entries(config.servers);

  const handleEdit = (key: string) => {
    setEditingKey(key);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingKey(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const handleSave = async (key: string, serverConfig: DownstreamServerConfig) => {
    if (editingKey) {
      await updateServer(key, serverConfig);
    } else {
      await addServer(key, serverConfig);
    }
  };

  const handleDelete = async (key: string) => {
    await removeServer(key);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Server</h2>
          <p className="text-muted-foreground">
            Downstream MCP-Server verwalten
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 size-4" />
          Server hinzufugen
        </Button>
      </div>

      {servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Noch keine Server konfiguriert
            </p>
            <Button variant="outline" onClick={handleAdd}>
              <Plus className="mr-2 size-4" />
              Ersten Server hinzufugen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {servers.map(([key, serverConfig]) => {
            const serverStatus = status?.servers[key];

            return (
              <Card key={key}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={serverConfig.enabled}
                      onCheckedChange={() => toggleServer(key)}
                    />
                    <div>
                      <CardTitle className="text-base">
                        {serverConfig.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{key}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {serverConfig.transport.type}
                    </Badge>

                    {serverConfig.enabled && serverStatus && (
                      <Badge
                        variant={
                          serverStatus.connected ? "default" : "secondary"
                        }
                      >
                        {serverStatus.connected
                          ? `${serverStatus.toolCount}T / ${serverStatus.resourceCount}R / ${serverStatus.promptCount}P`
                          : "Getrennt"}
                      </Badge>
                    )}

                    {!serverConfig.enabled && (
                      <Badge variant="secondary">Deaktiviert</Badge>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(key)}>
                          <Pencil className="mr-2 size-4" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(key)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Loschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <ServerForm
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
        initialKey={editingKey ?? undefined}
        initialConfig={editingKey ? config.servers[editingKey] : undefined}
      />
    </div>
  );
}
