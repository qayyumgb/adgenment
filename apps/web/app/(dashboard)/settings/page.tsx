"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { History } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAppRouter } from "@/hooks/useAppRouter";
import { cn } from "@/lib/cn";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { Button, useConfirm } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { TeamPanel } from "@/components/app/team/TeamPanel";
import { GeneralTab } from "@/components/app/settings/GeneralTab";
import { AiTab } from "@/components/app/settings/AiTab";
import { NotificationsTab } from "@/components/app/settings/NotificationsTab";
import { BillingTab } from "@/components/app/settings/BillingTab";
import { AuditLogDrawer } from "@/components/app/settings/AuditLogDrawer";
import type { SettingsSaver } from "@/components/app/settings/types";

/**
 * Settings (guide §5 Settings, plan A14): General (agency profile, reporting
 * defaults, your login, delete workspace), Team (B6), AI & automation (what
 * works today), Notifications (your email alerts) and Billing (plan and
 * usage). Integrations moved to Connections (A13). `?tab=` opens a tab.
 */

type Tab = "general" | "team" | "ai" | "notifications" | "billing";
const TABS: { id: Tab; label: string; summary: string }[] = [
  { id: "general", label: "General", summary: "Agency profile, reporting defaults and your login" },
  { id: "team", label: "Team", summary: "Roles control what each person can change and which clients they see" },
  { id: "ai", label: "AI & automation", summary: "Decide what Advertix can change without asking" },
  { id: "notifications", label: "Notifications", summary: "Where and when Advertix tells you things" },
  { id: "billing", label: "Billing", summary: "Your plan and what you use" },
];
const LEGACY: Record<string, Tab> = { workspace: "team" };

export default function SettingsPage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useAppRouter();
  const access = useAccess();
  const me = useApi((c) => c.getMe(), [], { key: "me" });
  const requested = params.get("tab");
  // Client viewers can't see the team or billing (the API refuses them too).
  const tabs = TABS.filter((t) => access.role !== "CLIENT_VIEWER" || (t.id !== "team" && t.id !== "billing"));
  const fromUrl = (LEGACY[requested ?? ""] ?? requested) as Tab | null;
  const tab: Tab = tabs.some((t) => t.id === fromUrl) ? fromUrl! : "general";
  const [saver, setSaver] = useState<SettingsSaver | null>(null);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  // "Saved" only right after a save, until the next edit or tab change.
  const [justSaved, setJustSaved] = useState(false);
  const stableSetSaver = useCallback((s: SettingsSaver | null) => {
    setSaver(s);
    if (!s || s.dirty) setJustSaved(false);
  }, []);

  // Integrations moved to its own page (A13); old links land there.
  useEffect(() => {
    if (requested === "integrations") router.replace("/connections");
  }, [requested, router]);

  const go = async (t: Tab) => {
    if (saver?.dirty && !(await confirm({ title: "Leave without saving?", body: "You have unsaved changes on this tab.", confirmLabel: "Leave", cancelLabel: "Stay", danger: true }))) return;
    setSaver(null);
    router.replace(`${pathname}${t === "general" ? "" : `?tab=${t}`}`);
  };

  const save = async () => {
    if (!saver) return;
    setSaving(true);
    try {
      await saver.save();
      setJustSaved(true);
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const workspaceName = me.data?.workspace?.name ?? "Workspace";
  const current = TABS.find((t) => t.id === tab)!;
  // Notifications are personal; General and AI & automation (approval rules) are owner-only (read-only for others, so no save button).
  const editable = tab === "notifications" || ((tab === "general" || tab === "ai") && access.can("workspace"));

  return (
    <>
      <PageHeader
        kicker={`${workspaceName} · workspace`}
        title="Settings"
        summary={current.summary}
        actions={
          <>
            <Button variant="secondary" icon={<History size={16} />} onClick={() => setAudit(true)}>
              Audit log
            </Button>
            {editable && (
              <span title={saver?.reason ?? undefined}>
                <Button variant="primary" loading={saving} disabled={!saver || !saver.dirty || saver.disabled} onClick={() => void save()}>
                  {justSaved && saver && !saver.dirty && !saving ? "Saved" : "Save changes"}
                </Button>
              </span>
            )}
          </>
        }
        tabs={
          <div role="tablist" aria-label="Settings sections" className="flex gap-5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab}
                onClick={() => void go(t.id)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm transition-colors",
                  t.id === tab ? "border-brand font-semibold text-ink" : "border-transparent font-medium text-ink-2 hover:text-ink"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />
      <PageBody className="max-w-[1180px] gap-5">
        {tab === "general" && <GeneralTab setSaver={stableSetSaver} />}
        {tab === "team" && <TeamPanel />}
        {tab === "ai" && <AiTab setSaver={stableSetSaver} />}
        {tab === "notifications" && <NotificationsTab setSaver={stableSetSaver} />}
        {tab === "billing" && <BillingTab />}
      </PageBody>
      <AuditLogDrawer open={audit} onClose={() => setAudit(false)} />
      {confirmDialog}
    </>
  );
}
