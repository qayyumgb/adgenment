"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useApiClient, type Client } from "@/lib/api";
import { Button, Dialog } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";

/**
 * Add / edit a client: name, initials (from the name unless changed),
 * industry, and an optional monthly budget with its currency (Budgets and
 * the monthly-cap rule use it). Adding doesn't switch to the new client:
 * it has no ad accounts yet, so the next step is assigning them.
 */

const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "AED", "SAR", "INR", "CAD", "AUD"];
const field = "h-10 w-full rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft";
const markOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

type Form = { name: string; short: string; vertical: string; budget: string; currency: string };

export function ClientDialog({ open, onClose, editing, onSaved }: { open: boolean; onClose: () => void; editing: Client | null; onSaved?: (c: Client) => void }) {
  const api = useApiClient();
  const { refreshClients } = useClientScope();
  const [form, setForm] = useState<Form>({ name: "", short: "", vertical: "", budget: "", currency: "" });
  const [shortTouched, setShortTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? { name: editing.name, short: editing.short, vertical: editing.vertical ?? "", budget: editing.monthlyBudget == null ? "" : String(editing.monthlyBudget), currency: editing.currency ?? "" }
        : { name: "", short: "", vertical: "", budget: "", currency: "" }
    );
    setShortTouched(Boolean(editing));
    setError(null);
  }, [open, editing]);

  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const budget = form.budget.trim() === "" ? null : Number(form.budget);
  const budgetOk = budget === null || (Number.isFinite(budget) && budget >= 0);
  const valid = form.name.trim().length > 0 && budgetOk && (!form.currency || /^[A-Za-z]{3}$/.test(form.currency));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const data = {
      name: form.name.trim(),
      short: (form.short.trim() || markOf(form.name)).slice(0, 3).toUpperCase() || null,
      vertical: form.vertical.trim() || null,
      monthlyBudget: budget,
      currency: form.currency.trim().toUpperCase() || null,
    };
    try {
      const c = editing ? await api.updateClient(editing.id, data) : await api.createClient(data);
      await refreshClients();
      toast.success(editing ? "Client updated" : `${c.name} added. Assign its ad accounts in Connections.`);
      onSaved?.(c);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the client.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : "Add a client"}
      sub={editing ? undefined : "A brand you run ads for. Assign its ad accounts next, and every page can show just this client."}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!valid} onClick={() => void save()}>
            {editing ? "Save" : "Add client"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Name
            <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value, ...(shortTouched ? {} : { short: markOf(e.target.value) }) })} maxLength={120} placeholder="Lumen Skincare" className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Initials
            <input value={form.short} onChange={(e) => (setShortTouched(true), set({ short: e.target.value.toUpperCase().slice(0, 3) }))} maxLength={3} placeholder="LS" className={`${field} text-center uppercase`} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
          Industry <span className="font-normal text-ink-3">(optional)</span>
          <input value={form.vertical} onChange={(e) => set({ vertical: e.target.value })} maxLength={120} placeholder="Beauty, SaaS, Real estate…" className={field} />
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Monthly budget <span className="font-normal text-ink-3">(optional)</span>
            <input value={form.budget} onChange={(e) => set({ budget: e.target.value })} inputMode="decimal" placeholder="e.g. 5000" aria-invalid={!budgetOk} className={`${field} ${budgetOk ? "" : "border-neg"}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Currency
            <input value={form.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase().slice(0, 3) })} list="client-currencies" placeholder="Auto" className={`${field} uppercase`} />
            <datalist id="client-currencies">
              {CURRENCIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>
        <span className="text-xs text-ink-3">The monthly budget powers pacing in Budgets and the monthly-cap safety rule. Leave the currency on Auto to use the ad accounts’ currency.</span>
        {error && <span className="text-[13px] text-neg">{error}</span>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
