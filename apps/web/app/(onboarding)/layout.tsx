import { Toaster } from "react-hot-toast";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 text-slate-900">
      {children}
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
          success: { iconTheme: { primary: "#10b981", secondary: "#0f172a" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#0f172a" } },
        }}
      />
    </div>
  );
}
