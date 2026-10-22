import { notFound } from "next/navigation";
import { DevUi } from "./DevUi";

export const metadata = { title: "UI kit (dev)", robots: { index: false } };

/** Dev-only visual check of every app primitive in both themes (plan A1). */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevUi />;
}
