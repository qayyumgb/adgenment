import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /ai-planner: page header, chat panel, plan placeholder. */
export default function AiPlannerLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap items-start gap-4 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <Skeleton className="h-[calc(100vh-210px)] min-h-[520px] min-w-0 flex-[1_1_420px] rounded-card" />
        <Skeleton className="h-[520px] min-w-0 flex-[1.2_1_460px] rounded-card" />
      </div>
    </>
  );
}
