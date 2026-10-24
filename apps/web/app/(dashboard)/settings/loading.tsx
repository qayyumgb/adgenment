import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /settings: page header with tabs, two cards. */
export default function SettingsLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3 pt-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full" />
      </div>
      <div className="flex max-w-[1180px] flex-col gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <Skeleton className="h-[360px] rounded-card" />
        <Skeleton className="h-[220px] rounded-card" />
      </div>
    </>
  );
}
