import { notFound } from "next/navigation";
import { DevSetup } from "./DevSetup";

export const metadata = { title: "Get started (dev)", robots: { index: false } };

/**
 * Dev-only: the real Get started page inside the shell. Signed out, its API
 * calls fail; the screenshot script answers them with demo JSON.
 */
export default function DevSetupPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevSetup />;
}
