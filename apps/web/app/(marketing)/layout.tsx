import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import { SiteHeader } from "@/components/marketing/site/SiteHeader";
import { SiteFooter } from "@/components/marketing/site/SiteFooter";
import {
  MarketingMotion,
  MOTION_GATE_SCRIPT,
} from "@/components/marketing/motion/MarketingMotion";
import "./marketing.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-mk-serif",
  display: "swap",
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mk min-h-screen ${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}
    >
      {/* Sets the scroll-reveal gate before first paint (see marketing.css). */}
      <script dangerouslySetInnerHTML={{ __html: MOTION_GATE_SCRIPT }} />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <MarketingMotion />
    </div>
  );
}
