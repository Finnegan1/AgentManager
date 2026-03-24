import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Wrench, BookOpen, Activity } from "lucide-react";
import { useAppGatewayStatus, useAppConfig, useAppSkills } from "@/contexts/app-context";

export function Dashboard() {
  const { status } = useAppGatewayStatus();
  const { config } = useAppConfig();
  const { skills } = useAppSkills();

  const serverCount = config ? Object.keys(config.servers).length : 0;
  const connectedServers = status
    ? Object.values(status.servers).filter((s) => s.connected).length
    : 0;
  const totalTools = status
    ? Object.values(status.servers).reduce((sum, s) => sum + s.toolCount, 0)
    : 0;
  const totalResources = status
    ? Object.values(status.servers).reduce(
        (sum, s) => sum + s.resourceCount,
        0,
      )
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Ubersicht uber den Agent Manager
        </p>
      </div>

      {/* Gateway Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gateway Status</CardTitle>
          <Activity className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant={status?.running ? "default" : "secondary"}>
              {status?.running ? "Running" : "Stopped"}
            </Badge>
            {status?.running && status.pid && (
              <span className="text-sm text-muted-foreground">
                PID: {status.pid}
              </span>
            )}
            {status?.running && status.startedAt && (
              <span className="text-sm text-muted-foreground">
                Gestartet:{" "}
                {new Date(status.startedAt).toLocaleTimeString("de-DE")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Server</CardTitle>
            <Server className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectedServers}/{serverCount}</div>
            <p className="text-xs text-muted-foreground">verbunden</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proxied Tools</CardTitle>
            <Wrench className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTools}</div>
            <p className="text-xs text-muted-foreground">
              von Downstream-Servern
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
            <Server className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResources}</div>
            <p className="text-xs text-muted-foreground">
              von Downstream-Servern
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skills</CardTitle>
            <BookOpen className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{skills.length}</div>
            <p className="text-xs text-muted-foreground">verfugbar</p>
          </CardContent>
        </Card>
      </div>

      {/* Server Status Details */}
      {status?.running && serverCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Server-Verbindungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(config!.servers)
                .filter(([, s]) => s.enabled)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, serverConfig]) => {
                  const serverStatus = status.servers[key];
                  const isConnected = serverStatus?.connected ?? false;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`size-2 rounded-full ${
                            isConnected
                              ? "bg-green-500"
                              : serverStatus?.error
                                ? "bg-red-500"
                                : "bg-yellow-500"
                          }`}
                        />
                        <div>
                          <span className="font-medium">{serverConfig.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{key}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {isConnected ? (
                          <>
                            <span>{serverStatus!.toolCount} Tools</span>
                            <span>{serverStatus!.resourceCount} Resources</span>
                            <span>{serverStatus!.promptCount} Prompts</span>
                          </>
                        ) : serverStatus?.error ? (
                          <Badge variant="destructive">{serverStatus.error}</Badge>
                        ) : (
                          <span className="text-yellow-600">Verbinden...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
