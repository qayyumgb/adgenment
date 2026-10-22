"use client";

import { Download, Plus } from "lucide-react";
import { AppShell } from "@/components/app/shell/AppShell";
import { PageBody, PageHeader, PageTabs } from "@/components/app/shell/PageHeader";
import { Button, Card, CardHeader, KpiCard } from "@/components/app/ui";

const SPARK = [12, 14, 11, 16, 15, 18, 17, 21, 19, 22, 20, 24, 23, 27];

/**
 * Renders the real shell. Without a signed-in session the API calls fail,
 * so this also shows the shell's empty / loading states.
 */
export function DevShell() {
  return (
    <AppShell>
      <PageHeader
        kicker="Wednesday, 21 October · All clients"
        title="Good morning"
        summary="Preview of the app shell with demo content"
        actions={
          <>
            <Button variant="secondary" icon={<Download size={16} />}>
              Export report
            </Button>
            <Button variant="primary" icon={<Plus size={16} strokeWidth={2.5} />}>
              New campaign
            </Button>
          </>
        }
        tabs={
          <PageTabs
            label="Sections"
            active="overview"
            tabs={[
              { id: "overview", label: "Overview", href: "/dev/shell" },
              { id: "adsets", label: "Ad sets", href: "/dev/shell", count: 3 },
              { id: "log", label: "Change log", href: "/dev/shell", count: 5 },
            ]}
          />
        }
      />
      <PageBody>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
          <KpiCard label="Spend" value="$184,620" delta={12.4} spark={SPARK} />
          <KpiCard label="Revenue" value="$704,020" delta={18.1} spark={SPARK} />
          <KpiCard label="ROAS" value="3.81x" delta={4.9} spark={SPARK} />
          <KpiCard label="Conversions" value="9,412" delta={15.2} spark={SPARK} />
          <KpiCard label="Cost / conversion" value="$19.62" delta={-2.4} higherIsBetter={false} spark={SPARK} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-64">
            <CardHeader title={`Section ${i + 1}`} sub="Scroll to check the sticky top bar and page header" />
          </Card>
        ))}
      </PageBody>
    </AppShell>
  );
}
