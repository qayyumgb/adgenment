import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

/**
 * C16b (Clerk production keys): logins aren't copied from the development
 * instance, so people who signed up with email + password must sign up again
 * with the same email (Google users just continue with Google). The API
 * relinks them to their existing account by verified email, keeping
 * workspaces and data. The note shows only on the production instance and
 * retires itself after the switch-over period.
 */
const SHOW_MOVE_NOTE =
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_live_") && Date.now() < Date.parse("2027-01-15");

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-4">
      <SignIn
        appearance={{
          variables: { colorPrimary: "#6448f2" },
        }}
      />
      {SHOW_MOVE_NOTE && (
        <p className="m-0 max-w-[400px] rounded-xl border border-line bg-surface px-4 py-3 text-center text-[13px] leading-relaxed text-ink-2">
          <strong className="font-semibold text-ink">Had an account before November 2026?</strong> We moved to a new sign-in system. Continue with Google, or{" "}
          <Link href="/sign-up" className="font-semibold text-brand-ink underline-offset-2 hover:underline">
            sign up
          </Link>{" "}
          again with the same email. Your workspace and data are kept.
        </p>
      )}
    </div>
  );
}
