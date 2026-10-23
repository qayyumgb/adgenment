"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import { Button, ButtonLink, Card, Skeleton } from "@/components/app/ui";
import { ROLE_LABEL, ROLE_SUB } from "@/components/app/team/access";

/**
 * Accept a team invite (plan B6). Clerk sends signed-out visitors to sign
 * in / sign up and back here. The invite only works for the invited email;
 * a workspace auto-created at sign-up is replaced when it's unused.
 */
export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const api = useApiClient();
  const { signOut } = useClerk();
  const info = useApi((c) => c.getInvite(token), [token]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.acceptInvite(token);
      // Full load so every cached query (me, clients) starts fresh in the new workspace.
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The invite didn't go through. Try again.");
      setBusy(false);
    }
  };

  const i = info.data;
  return (
    <div className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-4 py-10">
      <Card className="flex flex-col gap-5 p-7">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Users size={22} aria-hidden="true" />
        </span>
        {info.loading ? (
          <>
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : info.error || !i ? (
          <>
            <h1 className="m-0 text-xl font-semibold">This invite link doesn’t work</h1>
            <p className="m-0 text-sm text-ink-2">{info.error ?? "It may have been mistyped. Ask the person who invited you for a new link."}</p>
            <ButtonLink href="/dashboard" variant="secondary" className="self-start">
              Go to Advertix
            </ButtonLink>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <h1 className="m-0 text-xl font-semibold leading-snug">
                {i.inviterName ? `${i.inviterName} invited you to ${i.workspaceName}` : `You’re invited to ${i.workspaceName}`}
              </h1>
              <p className="m-0 text-sm text-ink-2">
                As <span className="font-semibold text-ink">{ROLE_LABEL[i.role]}</span>: {ROLE_SUB[i.role].charAt(0).toLowerCase() + ROLE_SUB[i.role].slice(1)}.
              </p>
            </div>

            {i.status === "member" ? (
              <div className="flex items-center gap-2 rounded-xl bg-pos-soft px-4 py-3 text-sm text-pos">
                <CheckCircle2 size={16} aria-hidden="true" /> You’re already in {i.workspaceName}.
              </div>
            ) : i.status !== "open" ? (
              <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
                {i.status === "expired" ? "This invite has expired. Ask for a new one." : i.status === "revoked" ? "This invite was cancelled. Ask for a new one." : "This invite was already used."}
              </div>
            ) : !i.emailMatches ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-none text-warn" aria-hidden="true" />
                <span>
                  This invite is for <strong>{i.email}</strong>, and you’re signed in as <strong>{i.signedInAs}</strong>. Sign in with the invited email to accept it.
                </span>
              </div>
            ) : null}

            {error && <div role="alert" className="rounded-xl border border-neg/30 bg-neg-soft px-4 py-3 text-sm text-neg">{error}</div>}

            <div className="flex flex-wrap gap-2">
              {i.status === "member" ? (
                <ButtonLink href="/dashboard" variant="primary">
                  Open Advertix
                </ButtonLink>
              ) : i.status === "open" && i.emailMatches ? (
                <Button variant="primary" loading={busy} onClick={() => void accept()}>
                  Join {i.workspaceName}
                </Button>
              ) : i.status === "open" ? (
                <Button variant="primary" onClick={() => void signOut({ redirectUrl: `/invite/${encodeURIComponent(token)}` })}>
                  Sign in as {i.email}
                </Button>
              ) : (
                <ButtonLink href="/dashboard" variant="secondary">
                  Go to Advertix
                </ButtonLink>
              )}
            </div>
          </>
        )}
      </Card>
      <p className="mt-4 text-center text-xs text-ink-3">Invites work for 7 days and only for the email they were sent to.</p>
    </div>
  );
}
