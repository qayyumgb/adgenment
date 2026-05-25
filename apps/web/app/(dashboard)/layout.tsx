"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      <div
        className="flex min-h-screen flex-col transition-[margin] duration-300 ease-out"
        style={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "12px",
            padding: "10px 14px",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "#0f172a" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#0f172a" },
          },
        }}
      />
    </div>
  );
}
