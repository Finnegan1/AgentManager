import { useState } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/contexts/app-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { AppSidebar, type Page } from "@/components/layout/app-sidebar";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ServerList } from "@/components/servers/server-list";
import { SkillList } from "@/components/skills/skill-list";
import { AgentChat } from "@/components/agent/agent-chat";

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "Dashboard",
  servers: "Server",
  skills: "Skills",
  agent: "Agent",
};

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
    <AppProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-sm font-semibold">
                {PAGE_TITLES[currentPage]}
              </h1>
              <div className="ml-auto">
                <ModeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
              {currentPage === "dashboard" && <Dashboard />}
              {currentPage === "servers" && <ServerList />}
              {currentPage === "skills" && <SkillList />}
              {currentPage === "agent" && <AgentChat />}
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </AppProvider>
    </ThemeProvider>
  );
}

export default App;
