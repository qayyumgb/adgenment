import { redirect } from "next/navigation";

/** Billing moved into Settings (plan A14). */
export default function BillingPage() {
  redirect("/settings?tab=billing");
}
