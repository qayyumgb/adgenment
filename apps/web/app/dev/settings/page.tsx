import { notFound } from "next/navigation";
import { DevSettings } from "./DevSettings";

export const metadata = { title: "Settings (dev)", robots: { index: false } };

/**
 * Dev-only: the real Settings page inside the shell. Signed out, its API calls
 * fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevSettingsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevSettings />;
}
