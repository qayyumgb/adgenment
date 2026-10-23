import { notFound } from "next/navigation";
import { DevAudiences } from "./DevAudiences";

export const metadata = { title: "Audiences (dev)", robots: { index: false } };

/**
 * Dev-only: the real Audiences page inside the shell. Signed out, its API calls
 * fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevAudiencesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevAudiences />;
}
