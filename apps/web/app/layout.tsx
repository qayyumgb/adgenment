import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://advertix.io"),
  title: {
    default: "Advertix — AI-Powered Ad Management",
    template: "%s | Advertix",
  },
  description:
    "Advertix is an AI-powered ad management platform. Manage campaigns across Facebook, Google, TikTok, LinkedIn and more from one intelligent workspace.",
  keywords: [
    "Advertix",
    "AI ad management",
    "Facebook ads",
    "Google ads",
    "TikTok ads",
    "campaign management",
    "ad automation",
  ],
  openGraph: {
    title: "Advertix",
    description: "The AI workspace for ads on every platform: plan, launch and optimise Meta, Google, TikTok and LinkedIn campaigns in one place.",
    siteName: "Advertix",
    url: "https://advertix.io",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Advertix — the AI workspace for ads on every platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Advertix — AI-Powered Ad Management",
    description: "The AI workspace for ads on every platform: plan, launch and optimise Meta, Google, TikTok and LinkedIn campaigns in one place.",
    site: "@advertix",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning: inline scripts add classes to <html>
          before hydration (`mk-motion` on marketing, `dark` in the app). */}
      <html
        lang="en"
        className={`h-full ${GeistSans.variable} ${GeistMono.variable}`}
        suppressHydrationWarning
      >
        {/* Body colours and font come from the tokens in globals.css. */}
        <body className="h-full">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
