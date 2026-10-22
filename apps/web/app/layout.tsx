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
    description: "AI-Powered Ads. Amplified.",
    siteName: "Advertix",
    url: "https://advertix.io",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Advertix — AI-Powered Ads. Amplified.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Advertix — AI-Powered Ad Management",
    description: "AI-Powered Ads. Amplified.",
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
