import type { Metadata } from "next";
import { THEME_SCRIPT, ThemeProvider } from "@/components/app/theme/ThemeProvider";

// Client portal (C4): private links, never indexed.
export const metadata: Metadata = {
  title: "Performance report",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <div className="min-h-screen bg-bg text-ink">{children}</div>
    </ThemeProvider>
  );
}
