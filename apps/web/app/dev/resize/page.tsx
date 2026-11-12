"use client";

import dynamic from "next/dynamic";

/** Dev-only (the /dev routes are public only in development): real canvas output of templates and one-click resize. */
const DevResize = dynamic(() => import("../templates/DevResize"), { ssr: false });

export default function DevResizePage() {
  if (process.env.NODE_ENV === "production") return null;
  return <DevResize />;
}
