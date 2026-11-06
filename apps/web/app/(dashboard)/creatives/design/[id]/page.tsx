"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/app/ui";

/**
 * The creative editor (plan C19a). Fabric.js loads only here, in the
 * browser, so it never weighs on the rest of the app.
 */
const Editor = dynamic(() => import("@/components/app/editor/Editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-64px)] items-center justify-center">
      <Skeleton className="h-[60%] w-[40%] rounded-card" />
    </div>
  ),
});

export default function DesignPage({ params }: { params: { id: string } }) {
  return <Editor designId={params.id} />;
}
