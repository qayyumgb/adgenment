"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Overlays";

/**
 * In-app confirm (replaces window.confirm): `await confirm({...})` resolves
 * true on the confirm button, false on Cancel / Esc / ✕. Render `dialog`
 * once in the component that calls it.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: "Delete “Spring”?", confirmLabel: "Delete", danger: true }))) return;
 */
export type ConfirmOptions = {
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
};

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };

  const dialog = (
    <Dialog
      open={opts !== null}
      onClose={() => close(false)}
      title={opts?.title ?? ""}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            {opts?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={opts?.danger ? "danger" : "primary"} onClick={() => close(true)}>
            {opts?.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      {opts?.body ? <div className="text-sm text-ink-2">{opts.body}</div> : null}
    </Dialog>
  );

  return { confirm, dialog };
}
