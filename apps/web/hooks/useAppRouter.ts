"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { startNavigation } from "@/components/app/shell/NavigationProgress";

/**
 * `useRouter` whose `push` shows the navigation progress bar straight away.
 * Use it for buttons and menu items that navigate; plain `<Link>`s get the
 * bar automatically. `replace` is left alone: pages use it to keep filters
 * and tabs in the URL, which shouldn't flash the bar.
 */
export function useAppRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => {
        startNavigation(href);
        router.push(href, options);
      },
    }),
    [router]
  );
}
