import { notFound } from "next/navigation";
import { DevConnections } from "./DevConnections";

export const metadata = { title: "Connections (dev)", robots: { index: false } };

/**
 * Dev-only: the real Connections page inside the shell. Signed out, its API
 * calls fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevConnectionsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevConnections />;
}
