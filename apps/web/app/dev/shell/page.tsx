import { notFound } from "next/navigation";
import { DevShell } from "./DevShell";

export const metadata = { title: "Shell (dev)", robots: { index: false } };

/** Dev-only preview of the app shell around demo page content (plan A2). */
export default function DevShellPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevShell />;
}
