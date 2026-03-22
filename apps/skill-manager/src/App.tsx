import { useState } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar, type Page } from "@/components/layout/app-sidebar";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ServerList } from "@/components/servers/server-list";
import { SkillList } from "@/components/skills/skill-list";

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "Dashboard",
  servers: "Server",
  skills: "Skills",
};

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  return (
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
          </header>
          <main className="flex-1 overflow-auto p-6">
            {currentPage === "dashboard" && <Dashboard />}
            {currentPage === "servers" && <ServerList />}
            {currentPage === "skills" && <SkillList />}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
