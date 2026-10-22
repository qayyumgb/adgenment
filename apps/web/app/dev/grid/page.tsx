import { notFound } from "next/navigation";
import { DevGrid } from "./DevGrid";

export const metadata = { title: "DataGrid (dev)", robots: { index: false } };

/** Dev-only preview of the shared DataGrid with demo rows (plan A3). */
export default function DevGridPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevGrid />;
}
