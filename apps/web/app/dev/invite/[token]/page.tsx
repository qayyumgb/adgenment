import { notFound } from "next/navigation";
import InvitePage from "@/app/(onboarding)/invite/[token]/page";

export const metadata = { title: "Invite (dev)", robots: { index: false } };

/** Dev-only: the invite page without the sign-in redirect; the screenshot script answers its API calls. */
export default function DevInvitePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <InvitePage />;
}
