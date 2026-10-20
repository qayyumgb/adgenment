import type { Metadata } from "next";
import { HomeHero } from "@/components/marketing/home/HomeHero";
import { LiveTour } from "@/components/marketing/home/LiveTour";
import { ProblemSection } from "@/components/marketing/home/ProblemSection";
import { NightShift } from "@/components/marketing/home/NightShift";
import { AiChain } from "@/components/marketing/home/AiChain";
import { AgenciesDemo } from "@/components/marketing/home/AgenciesDemo";
import { ReleaseBoard } from "@/components/marketing/home/ReleaseBoard";
import { TrustFaq } from "@/components/marketing/home/TrustFaq";
import { RoiEstimator } from "@/components/marketing/home/RoiEstimator";
import { CtaShell } from "@/components/marketing/ui/CtaBand";
import { AccentHeading } from "@/components/marketing/ui/Heading";
import { PillButton } from "@/components/marketing/ui/PillButton";
import { DEMO_HREF, SIGN_UP_HREF } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: { absolute: "Advertix — AI-Powered Ads. Amplified." },
  description:
    "One budget, five platforms, one AI that sees all of them. Plan, launch and optimize campaigns across Meta, Google, TikTok, Snapchat and LinkedIn from one workspace.",
};

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <LiveTour />
      <ProblemSection />
      <NightShift />
      <AiChain />
      <AgenciesDemo />
      <ReleaseBoard />
      <TrustFaq />
      <CtaShell>
        <div className="flex flex-wrap items-end gap-[clamp(28px,5vw,56px)]">
          <div className="flex flex-[1.2_1_420px] flex-col gap-5">
            <AccentHeading lead="Great campaigns," accent="not gated by team size." onDark reveal={false} />
            <p className="m-0 max-w-[520px] text-[#c9c6d8]">
              You shouldn’t need a 12-person growth team to spend $50k a month well. Advertix exists so a
              one-person founder can compete with the people who do.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <PillButton href={SIGN_UP_HREF} variant="white" className="px-[26px]">
                Start free
              </PillButton>
              <PillButton href={DEMO_HREF} variant="ghost-dark">
                Book a 20-min demo
              </PillButton>
            </div>
          </div>
          <RoiEstimator />
        </div>
      </CtaShell>
    </>
  );
}
