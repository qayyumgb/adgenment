"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApprovalSummary, waited } from "./useApprovals";

/**
 * Overview banner (plan C1): tells owners that Media buyer changes are
 * waiting for them, in amber once any has waited past 24 hours. Hidden when
 * nothing waits or the viewer isn't an owner.
 */
export function ApprovalsBanner() {
  const { data: s } = useApprovalSummary();
  if (!s?.decides || s.pending === 0) return null;
  const late = s.overdue > 0;
  return (
    <Link
      href="/activity"
      className={cn(
        "flex items-center gap-3 rounded-card border px-4 py-3 text-sm text-ink no-underline transition-colors",
        late ? "border-warn/40 bg-warn-soft hover:border-warn/60" : "border-line bg-surface hover:border-line-2"
      )}
    >
      <ClipboardCheck size={18} className={cn("flex-none", late ? "text-warn" : "text-brand")} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong>
          {s.pending} change{s.pending === 1 ? "" : "s"} waiting for your approval
        </strong>
        <span className="text-ink-2">
          {s.oldestAt && ` · oldest ${waited(s.oldestAt)}`}
          {late && s.timeout === "KEEP" && ` · ${s.overdue} past 24 hours, still pending`}
          {late && s.timeout !== "KEEP" && ` · ${s.overdue} past 24 hours, being ${s.timeout === "APPROVE" ? "approved" : "rejected"} automatically`}
        </span>
      </span>
      <span className="flex-none font-semibold text-brand">Review</span>
    </Link>
  );
}
