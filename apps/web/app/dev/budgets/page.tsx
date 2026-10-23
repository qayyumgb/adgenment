import { notFound } from "next/navigation";
import { DevBudgets } from "./DevBudgets";

export const metadata = { title: "Budgets (dev)", robots: { index: false } };

/**
 * Dev-only: the real Budgets page inside the shell. Signed out, its API calls
 * fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevBudgetsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevBudgets />;
}
