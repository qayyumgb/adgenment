// Geist (sans + mono) is loaded once in the root layout and inherited from
// <html>; importing it here too makes Next put its CSS in this layout's chunk
// only, breaking the font on non-marketing routes.
import { Instrument_Serif } from "next/font/google";
import { SiteHeader } from "@/components/marketing/site/SiteHeader";
import { SiteFooter } from "@/components/marketing/site/SiteFooter";
import {
  MarketingMotion,
  MOTION_GATE_SCRIPT,
} from "@/components/marketing/motion/MarketingMotion";
import { THEME_SCRIPT, ThemeProvider } from "@/components/app/theme/ThemeProvider";
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
  // Same light / dark / system preference as the dashboard (one stored
  // choice), applied before first paint so there's no flash.
  return (
    <ThemeProvider>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <div
        className={`mk min-h-screen ${instrumentSerif.variable}`}
      >
        {/* Sets the scroll-reveal gate before first paint (see marketing.css). */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_GATE_SCRIPT }} />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <MarketingMotion />
      </div>
    </ThemeProvider>
  );
}
