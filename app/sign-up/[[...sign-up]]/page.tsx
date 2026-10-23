import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background tactical-grid">
      {/* Google товчийг нууна — app/sign-in/[[...sign-in]]/page.tsx дахь тайлбарыг үзнэ үү */}
      <SignUp appearance={{ elements: { socialButtonsRoot: { display: "none" }, dividerRow: { display: "none" } } }} />
    </div>
  );
}
