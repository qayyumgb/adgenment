import { notFound } from "next/navigation";
import { DevTemplates } from "./DevTemplates";

export const metadata = { title: "Templates (dev)", robots: { index: false } };

/** Dev-only visual check of every editor template in the three ad sizes (plan C19b). */
export default function DevTemplatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevTemplates />;
}
