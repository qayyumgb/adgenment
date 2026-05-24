import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdGenius AI",
  description: "Multi-platform AI-powered ad management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className="h-full bg-white text-slate-900 dark:bg-dark-bg dark:text-slate-100">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
