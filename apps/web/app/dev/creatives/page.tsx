import { notFound } from "next/navigation";
import { DevCreatives } from "./DevCreatives";

export const metadata = { title: "Creatives (dev)", robots: { index: false } };

/**
 * Dev-only: the real Creatives page inside the shell. Signed out, its API calls
 * fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevCreativesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevCreatives />;
}
