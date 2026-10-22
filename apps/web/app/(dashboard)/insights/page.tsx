import { redirect } from "next/navigation";

/** Insights moved into Analytics as the "Advertix read" band (plan A10). */
export default function InsightsPage() {
  redirect("/analytics");
}
