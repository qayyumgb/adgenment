"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import BudgetsPage from "@/app/(dashboard)/budgets/page";

export function DevBudgets() {
  return (
    <AppShell>
      <BudgetsPage />
    </AppShell>
  );
}
