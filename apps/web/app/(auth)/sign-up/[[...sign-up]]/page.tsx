import { SignUp } from "@clerk/nextjs";
import { AuthShell, clerkAppearance } from "@/components/auth/AuthShell";

export default function SignUpPage() {
  return (
    <AuthShell mode="sign-up">
      <SignUp appearance={clerkAppearance} />
    </AuthShell>
  );
}
