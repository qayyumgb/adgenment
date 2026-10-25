import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <SignIn
        appearance={{
          variables: { colorPrimary: "#6448f2" },
        }}
      />
    </div>
  );
}
