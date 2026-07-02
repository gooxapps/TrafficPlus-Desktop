import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ReactNode } from "react";

export function DashboardLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
