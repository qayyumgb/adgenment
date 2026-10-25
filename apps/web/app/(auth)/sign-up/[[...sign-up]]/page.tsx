import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <SignUp
        appearance={{
          variables: { colorPrimary: "#6448f2" },
        }}
      />
    </div>
  );
}
