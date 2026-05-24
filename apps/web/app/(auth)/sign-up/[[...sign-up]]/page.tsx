import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-bg p-4">
      <SignUp
        appearance={{
          variables: { colorPrimary: "#6366f1" },
        }}
      />
    </div>
  );
}
